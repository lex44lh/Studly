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
from .models import Service
from .pricing import calculate_buyer_quote
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
        queryset = Service.objects.filter(status=Service.Status.PUBLISHED).select_related("performer").order_by("id")
        performer = self.request.query_params.get("performer")
        if performer is not None:
            queryset = queryset.filter(performer_id=positive_id(performer, "performer"))
        ids = self.request.query_params.get("ids")
        if ids is not None:
            parts = ids.split(",") if ids else []
            if len(parts) > 100:
                raise ValidationError({"ids": "За один запрос допускается не более 100 ID."})
            queryset = queryset.filter(pk__in=[positive_id(part, "ids") for part in parts])
        return queryset


class ServiceDetailView(PublicCatalogMixin, RetrieveAPIView):
    queryset = Service.objects.filter(status=Service.Status.PUBLISHED).select_related("performer")
    serializer_class = ServiceSerializer


@method_decorator(never_cache, name="dispatch")
class ServiceQuoteView(PublicCatalogMixin, RetrieveAPIView):
    """Цена услуги и надбавка заказчика 3%. Предварительный расчёт без оплаты."""

    queryset = Service.objects.filter(status=Service.Status.PUBLISHED)
    serializer_class = ServiceQuoteSerializer

    def retrieve(self, request, *args, **kwargs):
        service = self.get_object()
        if service.currency != "RUB":
            raise ValidationError({"currency": "Расчёт доступен только для услуг в RUB."})
        return Response(self.get_serializer(calculate_buyer_quote(service)).data)


class PerformerDetailView(PublicCatalogMixin, RetrieveAPIView):
    # Публичный профиль существует в каталоге, только если у него есть услуги.
    queryset = User.objects.filter(services__status=Service.Status.PUBLISHED).distinct()
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
        serializer.save(performer=self.request.user)


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
        return super().patch(request, *args, **kwargs)

    def perform_update(self, serializer):
        serializer.save(status=Service.Status.PENDING, revision=serializer.instance.revision + 1)
