from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import require_role
from accounts.portfolio_views import VersionedAction
from accounts.registration_serializers import StrictSerializer
from accounts.registration_views import PrivateRegistrationView
from catalog.models import Service
from catalog.visibility import public_services
from operations.services import Conflict, execute
from .models import Order, OrderEvent, Quote
from .pricing_v2 import price_snapshot
from .serializers import OrderSerializer
from .services import accept_order, cancel_order, decline_order
from .views import OrderListView, PrivateOrdersMixin, OrderPagination


class QuoteInput(StrictSerializer):
    service_id = serializers.IntegerField(min_value=1, max_value=2**63-1)
    extra_ids = serializers.ListField(child=serializers.UUIDField(), max_length=50, default=list)

    def validate_extra_ids(self, values):
        if len(set(values)) != len(values):
            raise serializers.ValidationError("Повторяющиеся дополнения.")
        return values


class PurchaseInput(StrictSerializer):
    quote_id = serializers.UUIDField()
    request_key = serializers.UUIDField()


def locked_service_for_purchase(user, service_id):
    initial = get_object_or_404(Service, pk=service_id)
    users = {u.pk: u for u in User.objects.select_for_update().filter(pk__in=[user.pk, initial.performer_id]).order_by("pk")}
    require_role(users[user.pk], "customer")
    service = get_object_or_404(public_services().select_for_update(of=("self",)).select_related("performer"), pk=service_id)
    if service.is_demo or service.performer_id == user.pk or service.price_amount <= 0 or service.currency != "RUB":
        raise ValidationError({"service_id": "Нужна реальная платная услуга другого исполнителя в RUB."})
    return service


def order_data(order, user):
    body = dict(OrderSerializer(order).data)
    body.update(revision=order.revision, tariff_code=order.tariff_code,
                base_price_amount=format(Decimal(order.base_price_amount if order.base_price_amount is not None else order.price_amount), ".2f"),
                selected_extras=order.selected_extras,
                quote_id=str(order.quote_id) if order.quote_id else None)
    body["available_actions"] = []
    if order.buyer_id == user.pk and order.status in ("pending_acceptance", "awaiting_payment"):
        body["available_actions"].append("cancel")
    if order.performer_id == user.pk and order.status == "pending_acceptance":
        body["available_actions"].extend(["accept", "decline"])
    body["payment_status"] = "unpaid"
    return body


class QuoteView(PrivateRegistrationView):
    @transaction.atomic
    def post(self, request):
        serializer = QuoteInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        service = locked_service_for_purchase(request.user, data["service_id"])
        quote = Quote.objects.create(buyer=request.user, service=service, snapshot=price_snapshot(service, data["extra_ids"]))
        return Response({"quote_id": str(quote.pk), **quote.snapshot}, status=201)


class QuoteDetailView(PrivateRegistrationView):
    def get(self, request, pk):
        quote = get_object_or_404(Quote, pk=pk, buyer=request.user)
        return Response({"quote_id": str(quote.pk), **quote.snapshot})


class OrdersV2View(PrivateRegistrationView):
    def get(self, request):
        queryset = PrivateOrdersMixin.get_queryset(self)
        pager = OrderPagination()
        return pager.get_paginated_response([order_data(x, request.user) for x in pager.paginate_queryset(queryset, request)])

    @transaction.atomic
    def post(self, request):
        serializer = PurchaseInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Та же уникальность buyer/request_key действует между v1 и v2.
        def create():
            quote = get_object_or_404(Quote, pk=data["quote_id"], buyer=request.user)
            service = locked_service_for_purchase(request.user, quote.service_id)
            existing = Order.objects.filter(buyer=request.user, request_key=data["request_key"]).first()
            if existing:
                if existing.quote_id != quote.pk:
                    raise Conflict("Ключ уже использован для другого заказа.")
                return order_data(existing, request.user)
            if Order.objects.filter(quote=quote).exists():
                raise Conflict("По этому quote уже создан заказ. Перечитайте свои заказы.")
            current = price_snapshot(service, [x["id"] for x in quote.snapshot["selected_extras"]])
            if current != quote.snapshot:
                raise Conflict("Условия или тариф изменились. Нужны новый quote и новое согласие.")
            s = quote.snapshot
            order = Order.objects.create(buyer=request.user, performer=service.performer, service=service,
                service_revision=s["service_revision"], request_key=data["request_key"], quote=quote,
                tariff_code=s["tariff_code"], base_price_amount=s["base_price_amount"], selected_extras=s["selected_extras"],
                **{key: s[key] for key in ("title", "description", "included", "duration_days", "price_amount", "currency", "buyer_fee_percent", "buyer_fee_amount", "total_amount")})
            OrderEvent.objects.create(order=order, actor=request.user, action="created", revision=order.revision)
            from conversations.models import Conversation
            Conversation.objects.create(order=order)
            return order_data(order, request.user)
        body, replayed = execute(actor=request.user, operation="order.create.v2", data=data, callback=create)
        return Response(body, status=200 if replayed else 201)


class OrderV2View(PrivateRegistrationView):
    def get(self, request, pk):
        order = get_object_or_404(PrivateOrdersMixin.get_queryset(self), pk=pk)
        return Response(order_data(order, request.user))


class OrderActionV2View(PrivateRegistrationView):
    def post(self, request, pk, action):
        serializer = VersionedAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "order_id": pk, "action": action}
        operations = {"accept": accept_order, "cancel": cancel_order, "decline": decline_order}
        if action not in operations:
            raise NotFound()
        def change():
            order = get_object_or_404(PrivateOrdersMixin.get_queryset(self).select_for_update(of=("self",)), pk=pk)
            if order.revision != data["revision"]:
                raise Conflict()
            return order_data(operations[action](user=request.user, pk=pk), request.user)
        body, _ = execute(actor=request.user, operation="order.action.v2", data=data, callback=change)
        return Response(body)


class OrderEventsView(PrivateRegistrationView):
    def get(self, request, pk):
        order = get_object_or_404(PrivateOrdersMixin.get_queryset(self), pk=pk)
        pager = OrderPagination()
        events = order.events.order_by("id")
        return pager.get_paginated_response([
            {"id": x.pk, "actor_id": x.actor_id, "action": x.action, "revision": x.revision, "created_at": x.created_at.isoformat()}
            for x in pager.paginate_queryset(events, request)])
