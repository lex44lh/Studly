from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError, connection
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Подтверждает работу HTTP-сервера без обращения к базе данных."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


@method_decorator(never_cache, name="dispatch")
class ReadinessView(HealthView):
    """Проверяет доступность PostgreSQL, не раскрывая настройки соединения."""

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except (DatabaseError, ImproperlyConfigured):
            return Response({"status": "unavailable"}, status=503)
        return Response({"status": "ok"})
