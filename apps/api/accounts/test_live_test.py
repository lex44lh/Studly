import io
import json
import os
import stat
import subprocess
import sys
from http.cookiejar import MozillaCookieJar
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User, PerformerProfile
from catalog.models import Service
from catalog.workspace import service_ready
from accounts.moderation import readiness
from orders.models import Order
from conversations.models import Conversation


class LiveTestConfigurationTests(SimpleTestCase):
    def check_config(self, **changes):
        with TemporaryDirectory() as directory:
            (Path(directory) / "separate.env").touch()
            env = dict(os.environ)
            env.update(STUDLY_ENV_FILE=str(Path(directory) / "separate.env"),
                       DJANGO_SETTINGS_MODULE="config.live_test", DJANGO_DEBUG="true",
                       STUDLY_LIVE_TEST_CONFIRM="isolated-synthetic-only",
                       DJANGO_MEDIA_ROOT=str(Path(directory) / "live-test-media"),
                       POSTGRES_DB="studly_live_test", POSTGRES_USER="studly_live_test",
                       YOOKASSA_TEST_SHOP_ID="", YOOKASSA_TEST_SECRET_KEY="",
                       TELEGRAM_BOT_TOKEN="", TELEGRAM_OIDC_CLIENT_ID="",
                       TELEGRAM_OIDC_CLIENT_SECRET="", TELEGRAM_OIDC_REDIRECT_URI="")
            env.update(changes)
            return subprocess.run([sys.executable, "-c", "import config.live_test"],
                cwd=settings.BASE_DIR, env=env, capture_output=True, timeout=15)

    def test_isolated_configuration_loads(self):
        self.assertEqual(self.check_config().returncode, 0)

    def test_email_on_live_requires_private_outbox_and_no_external_smtp(self):
        with TemporaryDirectory() as directory:
            options = {"STUDLY_EMAIL_AUTH_ENABLED": "true", "STUDLY_EMAIL_TEST_OUTBOX": directory,
                       "STUDLY_EMAIL_ACTION_URL": "http://127.0.0.1:3002/search"}
            self.assertEqual(self.check_config(**options).returncode, 0)
            self.assertNotEqual(self.check_config(**(options | {"STUDLY_EMAIL_SMTP_HOST": "smtp.example.test"})).returncode, 0)
            Path(directory).chmod(0o755)
            self.assertNotEqual(self.check_config(**options).returncode, 0)

    def test_working_database_media_and_payment_credentials_are_rejected(self):
        for changes in ({"POSTGRES_DB": "studly"}, {"POSTGRES_USER": "studly_api"},
                        {"DJANGO_MEDIA_ROOT": "/var/lib/studly-api/avatars"},
                        {"YOOKASSA_TEST_SECRET_KEY": "synthetic-not-a-key"},
                        {"TELEGRAM_BOT_TOKEN": "synthetic-not-a-token"},
                        {"TELEGRAM_OIDC_CLIENT_SECRET": "synthetic-not-a-secret"},
                        {"STUDLY_ENV_FILE": "/does-not-exist/studly-test.env"},
                        {"STUDLY_ENV_FILE": str(settings.BASE_DIR / ".env")},
                        {"STUDLY_ENV_FILE": ""}, {"STUDLY_LIVE_TEST_CONFIRM": ""}):
            with self.subTest(changes=changes):
                self.assertNotEqual(self.check_config(**changes).returncode, 0)


class LiveTestFixturesTests(TestCase):
    def seed(self):
        output = io.StringIO()
        call_command("seed_live_test", stdout=output)
        return json.loads(output.getvalue())

    @override_settings(STUDLY_LIVE_TEST_ENABLED=False)
    def test_commands_refuse_normal_settings_before_writing(self):
        with self.assertRaises(CommandError):
            self.seed()
        with TemporaryDirectory() as directory:
            cookie = Path(directory) / "cookie"
            with self.assertRaises(CommandError):
                call_command("live_test_session", actor="buyer", host="localhost", cookie_file=str(cookie))
            self.assertFalse(cookie.exists())
        self.assertEqual(User.objects.count(), 0)

    @override_settings(STUDLY_LIVE_TEST_ENABLED=True)
    def test_fixtures_are_repeatable_complete_and_cannot_authenticate_as_telegram(self):
        first = self.seed()
        self.assertEqual(self.seed(), first)
        self.assertEqual(User.objects.count(), 4)
        for user in User.objects.all():
            self.assertIsNone(user.telegram_id)
            self.assertFalse(user.has_usable_password())
            self.assertFalse(user.is_superuser)
        service = Service.objects.get(pk=first["service_id"])
        self.assertFalse(service.is_demo)
        self.assertEqual(service_ready(service), [])
        self.assertEqual(readiness(PerformerProfile.objects.get(user=service.performer)), [])
        staff = User.objects.get(pk=first["actors"]["moderator"])
        self.assertEqual(staff.user_permissions.count(), 3)
        self.assertEqual(Order.objects.count(), 0)

    @override_settings(STUDLY_LIVE_TEST_ENABLED=True)
    def test_actor_collision_refuses_seed_and_session_without_overwriting(self):
        fixture = self.seed()
        user = User.objects.get(pk=fixture["actors"]["buyer"])
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])
        with self.assertRaises(CommandError):
            self.seed()
        with TemporaryDirectory() as directory:
            path = Path(directory) / "cookie"
            with self.assertRaises(CommandError):
                call_command("live_test_session", actor="buyer", host="localhost", cookie_file=str(path))
            self.assertFalse(path.exists())
        user.refresh_from_db()
        self.assertTrue(user.is_superuser)

    @override_settings(STUDLY_LIVE_TEST_ENABLED=True)
    def test_synthetic_session_is_private_and_drives_real_quote_order_and_csrf(self):
        fixture = self.seed()
        with TemporaryDirectory() as directory:
            cookie_path = Path(directory) / "buyer.cookies"
            output = io.StringIO()
            call_command("live_test_session", actor="buyer", host="localhost", cookie_file=str(cookie_path), stdout=output)
            self.assertEqual(stat.S_IMODE(cookie_path.stat().st_mode), 0o600)
            jar = MozillaCookieJar(str(cookie_path))
            jar.load(ignore_discard=True)
            cookie = next(c for c in jar if c.name == settings.SESSION_COOKIE_NAME)
            self.assertNotIn(cookie.value, output.getvalue())
            with self.assertRaises(CommandError):
                call_command("live_test_session", actor="buyer", host="localhost", cookie_file=str(cookie_path))
            client = APIClient(enforce_csrf_checks=True)
            client.cookies[settings.SESSION_COOKIE_NAME] = cookie.value
            self.assertEqual(client.get(reverse("accounts:me")).status_code, 200)
            self.assertEqual(client.post("/api/v2/quotes/", {"service_id": fixture["service_id"]}, format="json").status_code, 403)
            token = client.get(reverse("accounts:csrf")).json()["csrf_token"]
            quote = client.post("/api/v2/quotes/", {"service_id": fixture["service_id"], "extra_ids": []},
                                format="json", HTTP_X_CSRFTOKEN=token)
            self.assertEqual(quote.status_code, 201, quote.content)
            self.assertEqual(quote.json()["total_amount"], "105.00")
            payload = {"quote_id": quote.json()["quote_id"], "request_key": str(uuid4())}
            order = client.post("/api/v2/orders/", payload, format="json", HTTP_X_CSRFTOKEN=token)
            self.assertEqual(order.status_code, 201, order.content)
            self.assertEqual(order.json()["status"], "pending_acceptance")
            self.assertEqual(client.post("/api/v2/orders/", payload, format="json", HTTP_X_CSRFTOKEN=token).status_code, 200)
            self.assertEqual(Order.objects.count(), 1)
            self.assertEqual(Conversation.objects.filter(order_id=order.json()["id"]).count(), 1)
