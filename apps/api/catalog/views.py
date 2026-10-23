from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import require_role
from .models import Service
from .pricing import calculate_buyer_quote
from .visibility import public_services
from .serializers import (OwnServiceSerializer, PerformerSerializer,
                          ServiceQuoteSerializer, ServiceSerializer)


class CatalogPagination(PageNumberPagination):
    page_size = 20


class PublicCatalogMixin:
    # Публичное чтение не зависит от наличия пользовательской cookie.
    authentication_classes = []
    permission_classes = [AllowAny]


def positive_id(value, field):
    if len(value) > 19 or not value.isascii() or not value.isdecimal() or not 0 < int(value) <= 2**63 - 1:
        raise ValidationError({field: "Ожидается положительный ID."})
    return int(value)


class ServiceListView(PublicCatalogMixin, ListAPIView):
    serializer_class = ServiceSerializer
    pagination_class = CatalogPagination
    filter_backends = [SearchFilter]
    search_fields = ["title", "description"]

    def get_queryset(self):
        queryset = public_services().select_related("performer").order_by("id")
        performer = self.request.query_params.get("performer")
        if performer is not None:
            queryset = queryset.filter(performer_id=positive_id(performer, "performer"))
        ids = self.request.query_params.get("ids")
        if ids is not None:
            parts = ids.split(",") if ids else []
            if len(parts) > 100:
                raise ValidationError({"ids": "За один запрос допускается не более 100 ID."})
            queryset = queryset.filter(pk__in=[positive_id(part, "ids") for part in parts])
        category = self.request.query_params.get("category", "").strip()
        if len(category) > 100:
            raise ValidationError({"category": "До 100 символов."})
        if category:
            queryset = queryset.filter(category=category)
        ranges = {}
        for parameter, lookup in {"min_price": "price_amount__gte", "max_price": "price_amount__lte"}.items():
            raw = self.request.query_params.get(parameter)
            if raw is not None:
                try:
                    if len(raw) > 32:
                        raise ValueError
                    value = Decimal(raw)
                    if not value.is_finite() or not Decimal(0) <= value <= Decimal("99999999.99") or value.as_tuple().exponent < -2:
                        raise ValueError
                except (ValueError, InvalidOperation):
                    raise ValidationError({parameter: "Нужна неотрицательная сумма до 99999999.99 с точностью до копейки."})
                ranges[parameter] = value
                queryset = queryset.filter(**{lookup: value})
        for parameter, lookup in {"min_duration": "duration_days__gte", "max_duration": "duration_days__lte"}.items():
            raw = self.request.query_params.get(parameter)
            if raw is not None:
                if len(raw) > 5 or not raw.isascii() or not raw.isdecimal() or not 1 <= int(raw) <= 32767:
                    raise ValidationError({parameter: "Нужно целое число дней 1–32767."})
                ranges[parameter] = int(raw)
                queryset = queryset.filter(**{lookup: int(raw)})
        for low, high in (("min_price", "max_price"), ("min_duration", "max_duration")):
            if low in ranges and high in ranges and ranges[low] > ranges[high]:
                raise ValidationError({high: "Верхняя граница меньше нижней."})
        ordering = self.request.query_params.get("ordering", "id")
        orders = {"id": ("id",), "newest": ("-id",), "price_asc": ("price_amount", "id"),
                  "price_desc": ("-price_amount", "id"), "duration_asc": ("duration_days", "id")}
        if ordering not in orders:
            raise ValidationError({"ordering": "Неподдерживаемая сортировка."})
        if "min_rating" in self.request.query_params:
            raise ValidationError({"min_rating": "Фильтр рейтинга ещё не поддерживается."})
        queryset = queryset.order_by(*orders[ordering])
        return queryset


class ServiceDetailView(PublicCatalogMixin, RetrieveAPIView):
    queryset = public_services().select_related("performer")
    serializer_class = ServiceSerializer


@method_decorator(never_cache, name="dispatch")
class ServiceQuoteView(PublicCatalogMixin, RetrieveAPIView):
    """Цена услуги и надбавка заказчика 3%. Предварительный расчёт без оплаты."""

    queryset = public_services()
    serializer_class = ServiceQuoteSerializer

    def retrieve(self, request, *args, **kwargs):
        service = self.get_object()
        if service.currency != "RUB":
            raise ValidationError({"currency": "Расчёт доступен только для услуг в RUB."})
        return Response(self.get_serializer(calculate_buyer_quote(service)).data)


class PerformerDetailView(PublicCatalogMixin, RetrieveAPIView):
    # Публичный профиль существует в каталоге, только если у него есть услуги.
    queryset = User.objects.filter(services__in=public_services()).distinct()
    serializer_class = PerformerSerializer


class OwnServicesMixin:
    serializer_class = OwnServiceSerializer
    parser_classes = [JSONParser]
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Service.objects.filter(performer=self.request.user).select_related("performer").order_by("id")


@method_decorator(never_cache, name="dispatch")
class OwnServiceListView(OwnServicesMixin, ListCreateAPIView):
    pagination_class = CatalogPagination

    def perform_create(self, serializer):
        with transaction.atomic():
            owner = User.objects.select_for_update().get(pk=self.request.user.pk)
            require_role(owner, "performer")
            serializer.save(performer=owner)


@method_decorator(never_cache, name="dispatch")
class OwnServiceDetailView(OwnServicesMixin, RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method == "PATCH":
            return queryset.select_for_update(of=("self",))
        return queryset

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        owner = User.objects.select_for_update().get(pk=request.user.pk)
        require_role(owner, "performer")
        return super().patch(request, *args, **kwargs)

    def perform_update(self, serializer):
        require_role(self.request.user, "performer")
        serializer.save(status=Service.Status.PENDING, revision=serializer.instance.revision + 1)
