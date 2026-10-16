from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class HealthEndpointTests(SimpleTestCase):
    # SimpleTestCase не разрешает запросы к БД: тест одновременно проверяет,
    # что маршрут работает без подключения к PostgreSQL.
    client_class = APIClient

    def test_health_is_public_and_returns_json_without_database_access(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(response["Content-Type"], "application/json")

    def test_health_rejects_post_requests(self):
        response = self.client.post(reverse("health"), {}, format="json")

        self.assertEqual(response.status_code, 405)


class ReadinessTests(TestCase):
    def test_public_readiness_really_queries_database_and_is_not_cached(self):
        with self.assertNumQueries(1):
            response = self.client.get(reverse("ready"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("no-store", response["Cache-Control"])


class ReadinessFailureTests(SimpleTestCase):
    def test_connection_or_configuration_failure_returns_503_without_details(self):
        for error in (OperationalError("private connection details"), ImproperlyConfigured("private settings")):
            with self.subTest(error=type(error).__name__), patch("health.views.connection") as database:
                database.cursor.side_effect = error
                response = self.client.get(reverse("ready"))
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json(), {"status": "unavailable"})
            self.assertIn("no-store", response["Cache-Control"])
            self.assertEqual(self.client.get(reverse("health")).status_code, 200)

    def test_readiness_rejects_writes_without_querying_database(self):
        self.assertEqual(self.client.post(reverse("ready")).status_code, 405)
