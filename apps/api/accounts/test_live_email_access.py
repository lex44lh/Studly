import io
import json
import stat
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, TestCase, override_settings

from accounts.models import EmailCredential
from catalog.models import Service


SIGN_IN = "/api/v1/auth/live-test/sign-in/"


@override_settings(STUDLY_LIVE_TEST_ENABLED=True, STUDLY_EMAIL_AUTH_ENABLED=True,
                   STUDLY_EMAIL_TEST_DOMAIN="example.test")
class LiveEmailAccessTests(TestCase):
    def test_rehearsal_accounts_are_private_and_can_enter_the_browser(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "credentials"
            output = io.StringIO()
            call_command("seed_live_email_testers", credentials_file=path, stdout=output)
            credentials = json.loads(path.read_text())
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            service = Service.objects.get(pk=credentials["service_id"])
            for role, (customer, performer) in {"buyer": (True, False), "performer": (False, True)}.items():
                with self.subTest(role=role):
                    login = credentials["accounts"][role]
                    self.assertNotIn(login["password"], output.getvalue())
                    account = EmailCredential.objects.get(username=login["username"]).user
                    self.assertEqual((account.is_customer, account.is_performer), (customer, performer))
                    self.assertFalse(account.is_staff or account.is_superuser)
                    if performer:
                        self.assertEqual(service.performer_id, account.pk)
                    client = Client(enforce_csrf_checks=True)
                    identifier = login["email"] if customer else login["username"]
                    fields = {"identifier": identifier, "password": login["password"]}
                    self.assertEqual(client.post(SIGN_IN, fields).status_code, 403)
                    page = client.get(SIGN_IN)
                    self.assertContains(page, "csrfmiddlewaretoken")
                    self.assertIn("no-store", page["Cache-Control"])
                    csrf = client.cookies[settings.CSRF_COOKIE_NAME].value
                    response = client.post(SIGN_IN, {**fields, "csrfmiddlewaretoken": csrf})
                    self.assertEqual(response.status_code, 303)
                    self.assertEqual(response["Location"], "/search")
                    self.assertEqual(client.get("/api/v1/auth/me/").json()["user"]["id"], account.pk)
            with self.assertRaises(CommandError):
                call_command("seed_live_email_testers", credentials_file=path)
            self.assertEqual(EmailCredential.objects.count(), 2)

    @override_settings(STUDLY_LIVE_TEST_ENABLED=False)
    def test_rehearsal_login_and_seeding_are_disabled_outside_the_synthetic_stand(self):
        self.assertEqual(self.client.get(SIGN_IN).status_code, 404)
        with TemporaryDirectory() as directory:
            path = Path(directory) / "credentials"
            with self.assertRaises(CommandError):
                call_command("seed_live_email_testers", credentials_file=path)
            self.assertFalse(path.exists())
