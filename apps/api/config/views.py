from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView


class ApiRootView(APIView):
    """STUDLY API. Личные услуги и заказы требуют входа."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        routes = {
            "health": "health",
            "ready": "ready",
            "services": "catalog:list",
            "my_services": "catalog:own-list",
            "orders": "orders:list",
            "auth_options": "accounts:options",
            "me": "accounts:me",
            "csrf": "accounts:csrf",
            "admin": "admin:index",
        }
        return Response({name: reverse(route, request=request) for name, route in routes.items()})
