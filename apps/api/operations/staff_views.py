"""Минимальные рабочие проекции. Нет общего API чтения личных сообщений."""
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import PerformerProfile, User
from accounts.moderation import profile_data
from accounts.portfolio_views import example_data
from accounts.registration_views import PrivateRegistrationView
from catalog.models import Service
from catalog.workspace import service_data
from conversations.models import SecurityCase
from conversations.views import case_data
from orders.models import Order
from orders.serializers import OrderSerializer
from orders.views import OrderPagination
from .models import AuditEvent

PERMISSIONS = {"users": "accounts.view_user", "performers": "accounts.moderate_performer",
               "services": "catalog.moderate_service", "orders": "orders.view_order",
               "events": "operations.view_auditevent", "security-cases": "conversations.review_security_case"}


def require_staff(user, resource=None):
    if not user.is_staff or (resource and not user.has_perm(PERMISSIONS[resource])):
        raise PermissionDenied()


def project(resource, item):
    if resource == "users":
        return {"id": item.pk, "display_name": item.display_name, "is_active": item.is_active,
                "roles": [x for x in ("customer", "performer") if getattr(item, "is_"+x)]}
    if resource == "performers":
        return {**profile_data(item), "display_name": item.user.display_name, "description": item.description,
                "examples": [example_data(x) for x in item.examples.filter(active=True)]}
    if resource == "services":
        return service_data(item)
    if resource == "orders":
        return OrderSerializer(item).data
    if resource == "events":
        return {"id": item.pk, "actor_id": item.actor_id, "operation": item.operation, "target": item.target,
                "details": item.details, "created_at": item.created_at.isoformat()}
    return case_data(item)


class StaffSessionView(PrivateRegistrationView):
    def get(self, request):
        require_staff(request.user)
        return Response({"id": request.user.pk, "display_name": request.user.display_name,
                         "resources": [key for key, perm in PERMISSIONS.items() if request.user.has_perm(perm)],
                         "unavailable": ["payments", "payouts", "arbitration_commands", "reviews", "finance_reports", "analytics"]})


class StaffResourcesView(PrivateRegistrationView):
    def get(self, request, resource, pk=None):
        if resource not in PERMISSIONS:
            raise NotFound()
        require_staff(request.user, resource)
        queries = {"users": User.objects.all(), "performers": PerformerProfile.objects.select_related("user"),
                   "services": Service.objects.select_related("performer"),
                   "orders": Order.objects.select_related("buyer", "performer", "closed_by"),
                   "events": AuditEvent.objects.all(), "security-cases": SecurityCase.objects.select_related("message")}
        rows = queries[resource].order_by("pk")
        if pk is not None:
            return Response(project(resource, get_object_or_404(rows, **{"user_id" if resource == "performers" else "pk": pk})))
        status = request.query_params.get("status")
        if status:
            if resource == "performers" and status in PerformerProfile.Moderation.values:
                rows = rows.filter(moderation_status=status)
            elif resource in ("services", "orders") and status in (Service.Status.values if resource == "services" else Order.Status.values):
                rows = rows.filter(status=status)
            else:
                raise ValidationError({"status": "Неподдерживаемый статус."})
        search = request.query_params.get("search", "").strip()
        if len(search) > 200:
            raise ValidationError({"search": "До 200 символов."})
        if search:
            fields = {"users": "display_name", "performers": "user__display_name", "services": "title", "orders": "title", "events": "operation"}
            if resource not in fields:
                raise ValidationError({"search": "Поиск для ресурса не поддерживается."})
            rows = rows.filter(**{fields[resource]+"__icontains": search})
        pager = OrderPagination()
        return pager.get_paginated_response([project(resource, x) for x in pager.paginate_queryset(rows, request)])
