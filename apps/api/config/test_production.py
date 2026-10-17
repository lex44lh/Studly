"""Проверки настоящей production-конфигурации в отдельном процессе."""

import os
import subprocess
import sys

from django.test import SimpleTestCase


class ProductionSettingsTests(SimpleTestCase):
    def run_production(self, code, **overrides):
        environment = {
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "config.production",
            "DJANGO_DEBUG": "false",
            "DJANGO_SECRET_KEY": "test-only-production-settings-" * 3,
            "DJANGO_ALLOWED_HOSTS": "studly-help.ru",
            "DJANGO_CSRF_TRUSTED_ORIGINS": "https://studly-help.ru",
            **overrides,
        }
        return subprocess.run(
            [sys.executable, "-c", code],
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_refuses_debug_and_wildcard_hosts(self):
        for environment in (
            {"DJANGO_DEBUG": "true"},
            {"DJANGO_ALLOWED_HOSTS": "*"},
            {"DJANGO_ALLOWED_HOSTS": ""},
        ):
            with self.subTest(environment=environment):
                result = self.run_production("import django; django.setup()", **environment)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ImproperlyConfigured", result.stderr)

    def test_refuses_development_secret(self):
        result = self.run_production(
            "import django; django.setup()",
            DJANGO_SECRET_KEY="django-insecure-studly-local-development-only-not-for-production",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ImproperlyConfigured", result.stderr)

    def test_http_redirects_and_proxy_https_keeps_secure_csrf_cookie(self):
        result = self.run_production('''
import django
django.setup()
from django.test import Client
from django.conf import settings
assert settings.SESSION_COOKIE_SECURE and settings.SESSION_COOKIE_HTTPONLY
assert settings.SESSION_COOKIE_SAMESITE == "Lax"
assert settings.REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] == ["rest_framework.renderers.JSONRenderer"]
client = Client(HTTP_HOST="studly-help.ru")
response = client.get("/api/v1/health/")
assert response.status_code == 301, response.status_code
assert response["Location"] == "https://studly-help.ru/api/v1/health/"
response = client.get("/api/v1/health/", HTTP_X_FORWARDED_PROTO="https")
assert response.status_code == 200, response.status_code
assert response.json() == {"status": "ok"}
response = client.get("/api/v1/auth/csrf/", HTTP_X_FORWARDED_PROTO="https")
assert response.status_code == 200, response.status_code
cookie = response.cookies["csrftoken"]
assert cookie["secure"] and cookie["httponly"]
assert cookie["samesite"] == "Lax"
assert response["Strict-Transport-Security"] == "max-age=3600"
assert "no-store" in response["Cache-Control"]
response = client.get("/api/v1/health/", HTTP_HOST="untrusted.example", HTTP_X_FORWARDED_PROTO="https")
assert response.status_code == 400, response.status_code
''')
        self.assertEqual(result.returncode, 0, result.stderr)
