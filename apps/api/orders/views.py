from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Order
from .serializers import AcceptOrderSerializer, CreateOrderSerializer, OrderSerializer
from .services import accept_order, create_order


class OrderPagination(PageNumberPagination):
    page_size = 20


class PrivateOrdersMixin:
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    serializer_class = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(Q(buyer=user) | Q(performer=user)).select_related(
            "buyer", "performer"
        ).order_by("-id")


@method_decorator(never_cache, name="dispatch")
class OrderListView(PrivateOrdersMixin, ListAPIView):
    pagination_class = OrderPagination

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, created = create_order(buyer=request.user, data=serializer.validated_data)
        return Response(OrderSerializer(order).data, status=201 if created else 200)


@method_decorator(never_cache, name="dispatch")
class OrderDetailView(PrivateOrdersMixin, RetrieveAPIView):
    pass


@method_decorator(never_cache, name="dispatch")
class OrderAcceptView(PrivateOrdersMixin, GenericAPIView):
    serializer_class = AcceptOrderSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = accept_order(user=request.user, pk=pk)
        return Response(OrderSerializer(order).data)
