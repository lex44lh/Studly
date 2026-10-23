from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from accounts.registration_serializers import EmptyAction
from accounts.registration_views import PrivateRegistrationView
from .models import Favorite, Service
from .serializers import ServiceSerializer
from .views import CatalogPagination
from .visibility import public_services


@method_decorator(never_cache, name="dispatch")
class FavoriteListView(ListAPIView):
    serializer_class = ServiceSerializer
    pagination_class = CatalogPagination

    def get_queryset(self):
        return public_services().filter(favorite__user=self.request.user).select_related("performer").order_by("id")


class FavoriteView(PrivateRegistrationView):
    @transaction.atomic
    def put(self, request, pk):
        serializer = EmptyAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = public_services().select_for_update(of=("self",)).filter(pk=pk).first()
        if service is None:
            raise NotFound("Опубликованная услуга не найдена.")
        Favorite.objects.get_or_create(user=request.user, service=service)
        return Response(status=204)

    def delete(self, request, pk):
        serializer = EmptyAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        Favorite.objects.filter(user=request.user, service_id=pk).delete()
        return Response(status=204)
