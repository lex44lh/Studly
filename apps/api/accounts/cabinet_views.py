"""Личный кабинет — проекция настоящих данных, а не второй профиль/заказ."""

from django.db.models import Count
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from catalog.models import Service
from orders.models import Order
from .permissions import account_capabilities, require_role
from .registration import registration_data, registration_user
from .registration_views import PrivateRegistrationView
from .models import PerformerProfile
from .moderation import profile_data


class AccountView(PrivateRegistrationView):
    def get(self, request):
        user = registration_user(request.user.pk)
        return Response({
            "id": user.pk,
            "registration": registration_data(user),
            "capabilities": account_capabilities(user),
        })


class CabinetView(PrivateRegistrationView):
    def get(self, request):
        role = request.query_params.get("role")
        if role not in ("customer", "performer"):
            raise ValidationError({"role": "Укажите customer или performer."})
        require_role(request.user, role)
        user = registration_user(request.user.pk)
        orders = Order.objects.filter(**{
            "buyer_id" if role == "customer" else "performer_id": user.pk,
        })
        order_counts = {status: 0 for status in Order.Status.values}
        order_counts.update({row["status"]: row["count"] for row in
                             orders.values("status").annotate(count=Count("pk"))})
        services = None
        if role == "performer":
            services = {status: 0 for status in Service.Status.values}
            services.update({row["status"]: row["count"] for row in
                             Service.objects.filter(performer=user).values("status").annotate(count=Count("pk"))})
        return Response({
            "role": role, "account_id": user.pk,
            "registration": registration_data(user),
            "capabilities": account_capabilities(user),
            "orders": {"count": orders.count(), "by_status": order_counts,
                       "url": f"/api/v1/orders/?role={role}"},
            "services": services,
            "moderation": profile_data(user.performer_profile) if hasattr(user, "performer_profile") else None,
            # Пока нет подтверждённых completed/review источников. Null означает
            # недоступность, а не выдуманный рейтинг и не доказанное отсутствие отзывов.
            "statistics": {"completed_orders": None, "rating": None, "review_count": None},
            "unavailable": ["execution", "reviews", "rating"],
        })
