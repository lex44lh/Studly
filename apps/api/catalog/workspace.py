"""Услуги STUDLY 2: отдельный контракт черновика и явной подачи."""
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import PortfolioExample, User
from accounts.moderation import locked_profile, readiness
from accounts.permissions import require_role
from accounts.portfolio_views import DecisionInput, VersionedAction
from accounts.registration_serializers import StrictSerializer
from accounts.registration_views import PrivateRegistrationView
from operations.services import Conflict, audit, execute
from .models import Service
from .serializers import ServiceSerializer
from .views import ServiceListView, ServiceDetailView


class ExtraInput(StrictSerializer):
    id = serializers.UUIDField()
    title = serializers.CharField(max_length=200)
    price_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    extra_days = serializers.IntegerField(min_value=0, max_value=32766)


class DraftInput(StrictSerializer):
    request_key = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=0, max_value=2**63-1)
    title = serializers.CharField(max_length=200, allow_blank=True, required=False)
    description = serializers.CharField(max_length=10000, allow_blank=True, required=False)
    category = serializers.CharField(max_length=100, allow_blank=True, required=False)
    price_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False)
    duration_days = serializers.IntegerField(min_value=1, max_value=32767, required=False)
    included = serializers.ListField(child=serializers.CharField(max_length=500), max_length=50, required=False)
    extras = ExtraInput(many=True, required=False)
    portfolio_example_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, required=False)

    def validate(self, data):
        extras = data.get("extras", [])
        if len(extras) > 50 or len({x["id"] for x in extras}) != len(extras):
            raise serializers.ValidationError({"extras": "До 50 дополнений с разными UUID."})
        ids = data.get("portfolio_example_ids", [])
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError({"portfolio_example_ids": "Повторяющиеся ID."})
        return data


class PublicServiceV2Serializer(ServiceSerializer):
    class Meta(ServiceSerializer.Meta):
        fields = [*ServiceSerializer.Meta.fields, "revision", "category", "extras"]


class ServiceListV2View(ServiceListView):
    serializer_class = PublicServiceV2Serializer


class ServiceDetailV2View(ServiceDetailView):
    serializer_class = PublicServiceV2Serializer


def service_data(service):
    return {**PublicServiceV2Serializer(service).data, "status": service.status,
            "reason": service.moderation_reason,
            "portfolio_example_ids": [str(pk) for pk in service.portfolio_examples.values_list("pk", flat=True)]}


def service_ready(service):
    missing = []
    for field in ("title", "description", "category"):
        if not getattr(service, field).strip():
            missing.append(field)
    if service.price_amount <= 0:
        missing.append("price_amount")
    if not service.included:
        missing.append("included")
    if not service.portfolio_examples.filter(active=True, profile__user_id=service.performer_id).exists():
        missing.append("portfolio_example_ids")
    return missing


def require_approved(profile):
    if profile.moderation_status != "approved" or readiness(profile):
        raise ValidationError({"performer": "Нужно действующее одобрение заполненного профиля."})


class OwnServicesV2View(PrivateRegistrationView):
    def get(self, request):
        from .views import CatalogPagination
        pager = CatalogPagination()
        queryset = Service.objects.filter(performer=request.user).select_related("performer").order_by("id")
        return pager.get_paginated_response([service_data(x) for x in pager.paginate_queryset(queryset, request)])

    def post(self, request):
        return mutate_service(request, None)


class OwnServiceV2View(PrivateRegistrationView):
    def get(self, request, pk):
        return Response(service_data(get_object_or_404(Service, pk=pk, performer=request.user)))

    def patch(self, request, pk):
        return mutate_service(request, pk)


def mutate_service(request, pk):
    require_role(request.user, "performer")
    serializer = DraftInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = {**serializer.validated_data, "service_id": pk}
    if pk is not None and not set(data) - {"request_key", "revision", "service_id"}:
        raise ValidationError("Укажите хотя бы одно поле услуги.")
    def save():
        profile = locked_profile(request.user.pk)
        require_role(profile.user, "performer")
        if pk is None:
            if data["revision"] != 0:
                raise Conflict("Новый черновик требует revision=0.")
            service = Service(performer=profile.user, title="", description="", price_amount=0,
                              duration_days=1, status="draft")
        else:
            service = get_object_or_404(Service.objects.select_for_update(), pk=pk, performer_id=request.user.pk)
            if service.revision != data["revision"]:
                raise Conflict()
            service.revision += 1
            service.status = "pending" if service.status == "published" else "draft"
        examples = None
        if "portfolio_example_ids" in data:
            examples = list(PortfolioExample.objects.filter(pk__in=data["portfolio_example_ids"], profile=profile, active=True))
            if len(examples) != len(data["portfolio_example_ids"]):
                raise ValidationError({"portfolio_example_ids": "Работы не найдены в своём портфолио."})
        for key in ("title", "description", "category", "price_amount", "duration_days", "included"):
            if key in data:
                setattr(service, key, data[key])
        if "extras" in data:
            service.extras = [{**x, "id": str(x["id"]), "price_amount": format(x["price_amount"], ".2f")} for x in data["extras"]]
        service.moderation_reason = ""
        service.save()
        if examples is not None:
            service.portfolio_examples.set(examples)
        audit(request.user, "service.save", service.pk, revision=service.revision)
        return service_data(service)
    body, replayed = execute(actor=request.user, operation="service.save", data=data, callback=save)
    return Response(body, status=201 if pk is None and not replayed else 200)


class ServiceSubmitView(PrivateRegistrationView):
    def post(self, request, pk):
        require_role(request.user, "performer")
        serializer = VersionedAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "service_id": pk}
        def submit():
            profile = locked_profile(request.user.pk)
            require_approved(profile)
            service = get_object_or_404(Service.objects.select_for_update(), pk=pk, performer=request.user)
            if service.revision != data["revision"] or service.status not in ("draft", "rejected", "changes"):
                raise Conflict()
            if missing := service_ready(service):
                raise ValidationError({"missing_fields": missing})
            service.status = "pending"
            service.revision += 1
            service.save(update_fields=["status", "revision"])
            audit(request.user, "service.submit", service.pk, revision=service.revision)
            return service_data(service)
        body, _ = execute(actor=request.user, operation="service.submit", data=data, callback=submit)
        return Response(body)


class ServiceDecisionView(PrivateRegistrationView):
    def post(self, request, pk):
        if not request.user.is_staff or not request.user.has_perm("catalog.moderate_service"):
            raise PermissionDenied()
        serializer = DecisionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "service_id": pk}
        def decide():
            owner_id = get_object_or_404(Service, pk=pk).performer_id
            if owner_id == request.user.pk:
                raise PermissionDenied("Нельзя модерировать свою услугу.")
            profile = locked_profile(owner_id)
            service = get_object_or_404(Service.objects.select_for_update(), pk=pk)
            if service.revision != data["revision"] or service.status != "pending":
                raise Conflict()
            if data["decision"] == "approved":
                require_approved(profile)
                if missing := service_ready(service):
                    raise ValidationError({"missing_fields": missing})
            service.status = "published" if data["decision"] == "approved" else data["decision"]
            service.moderation_reason = data["reason"]
            service.revision += 1
            service.save(update_fields=["status", "moderation_reason", "revision"])
            audit(request.user, "service.decide", pk, revision=service.revision, decision=data["decision"], reason=data["reason"])
            return service_data(service)
        body, _ = execute(actor=request.user, operation="service.decide", data=data, callback=decide)
        return Response(body)
