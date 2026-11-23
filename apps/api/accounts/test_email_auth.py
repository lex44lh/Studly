"""Email-only identities, deliberate linking, reset and anti-abuse regressions."""
from datetime import timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

from django.conf import settings
from django.contrib.sessions.models import Session
from django.core import mail
from django.core.management import call_command
from django.test import RequestFactory, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from . import email_auth
from .models import EmailAttempt, EmailChallenge, EmailCredential, User
from .telegram import TelegramNotConfigured

PASSWORD = "Q9!river-Bird-spaces"
NEXT_PASSWORD = "X7!cloud-Raven-after"


@override_settings(
    STUDLY_EMAIL_AUTH_ENABLED=True,
    STUDLY_EMAIL_ACTION_URL="https://studly.example.test/auth/email",
    STUDLY_EMAIL_TEST_DOMAIN="example.test",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="studly@example.test",
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class EmailAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def post(self, name, body, client=None):
        client = client or self.client
        token = client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return client.post(reverse("accounts:" + name), body, format="json", HTTP_X_CSRFTOKEN=token)

    def deliver(self):
        call_command("deliver_email_auth", verbosity=0)
        self.assertTrue(mail.outbox)
        links = [line for line in mail.outbox[-1].body.splitlines() if line.startswith("https://")]
        self.assertEqual(len(links), 1)
        parsed = urlsplit(links[0])
        self.assertEqual(parsed.query, "")
        fragment = parse_qs(parsed.fragment)
        return fragment["token"][0]

    def begin(self, email="learner@example.test"):
        response = self.post("email-register", {"email": email})
        self.assertEqual(response.status_code, 202, response.content)
        self.assertNotIn("token", response.json())
        return self.deliver()

    def register(self, email="learner@example.test", username="learner_one"):
        proof = self.begin(email)
        response = self.post("email-verify", {"token": proof, "username": username, "password": PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        return User.objects.get(pk=response.json()["user"]["id"]), proof

    def test_register_requires_mailbox_proof_before_setting_password_and_canonicalizes(self):
        proof = self.begin("  Learner+Topic@EXAMPLE.TEST  ")
        self.assertEqual(User.objects.count(), 0)
        challenge = EmailChallenge.objects.get()
        self.assertNotEqual(proof, challenge.selector)
        self.assertNotIn(proof, repr(challenge.__dict__))
        response = self.post("email-verify", {"token": proof, "username": "  Learner_One  ", "password": PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        user = User.objects.get()
        credential = EmailCredential.objects.get()
        self.assertEqual(credential.email, "learner+topic@example.test")
        self.assertEqual(credential.username, "learner_one")
        self.assertIsNone(user.telegram_id)
        self.assertEqual(user.email, "")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual(set(response.json()["user"]), {"id", "display_name", "telegram_username"})
        self.assertEqual(EmailChallenge.objects.count(), 0)
        self.assertEqual(self.post("email-verify", {"token": proof, "username": "other_name", "password": PASSWORD}).status_code, 400)

    def test_unknown_existing_and_inactive_identifiers_share_login_error_and_dummy_hash(self):
        user, _ = self.register()
        self.client.logout()
        with patch("accounts.email_auth.make_password", wraps=email_auth.make_password) as dummy:
            unknown = self.post("email-login", {"identifier": "unknown@example.test", "password": PASSWORD})
            self.assertTrue(dummy.called)
        wrong = self.post("email-login", {"identifier": "learner@example.test", "password": NEXT_PASSWORD})
        user.is_active = False
        user.save(update_fields=["is_active"])
        inactive = self.post("email-login", {"identifier": "learner_one", "password": PASSWORD})
        self.assertEqual((unknown.status_code, wrong.status_code, inactive.status_code), (401, 401, 401))
        self.assertEqual(unknown.json(), wrong.json())
        self.assertEqual(wrong.json(), inactive.json())

    def test_email_and_username_login_rotate_session_and_clear_telegram_proof(self):
        user, _ = self.register()
        old_session = self.client.cookies[settings.SESSION_COOKIE_NAME].value
        session = self.client.session
        session[email_auth.TELEGRAM_PROOF] = {"user_id": user.pk, "at": timezone.now().timestamp()}
        session.save()
        result = self.post("email-login", {"identifier": " LEARNER_ONE ", "password": PASSWORD})
        self.assertEqual(result.status_code, 200)
        self.assertNotEqual(self.client.cookies[settings.SESSION_COOKIE_NAME].value, old_session)
        self.assertNotIn(email_auth.TELEGRAM_PROOF, self.client.session)
        self.client.logout()
        self.assertEqual(self.post("email-login", {"identifier": " LEARNER@EXAMPLE.TEST ", "password": PASSWORD}).status_code, 200)

    @override_settings(SESSION_COOKIE_AGE=120)
    def test_session_expiry_is_enforced_and_only_login_renews_it(self):
        user, _ = self.register()
        cookie = settings.SESSION_COOKIE_NAME
        first_key = self.client.cookies[cookie].value
        first_expiry = Session.objects.get(session_key=first_key).expire_date
        self.assertEqual(self.client.get(reverse("accounts:me")).status_code, 200)
        self.assertEqual(Session.objects.get(session_key=first_key).expire_date, first_expiry)

        expired = timezone.now() - timedelta(seconds=1)
        Session.objects.filter(session_key=first_key).update(expire_date=expired)
        self.assertEqual(self.client.get(reverse("accounts:me")).status_code, 403)

        login = self.post("email-login", {"identifier": "learner_one", "password": PASSWORD})
        self.assertEqual(login.json()["user"]["id"], user.pk)
        second_key = self.client.cookies[cookie].value
        self.assertNotEqual(second_key, first_key)
        self.assertGreater(Session.objects.get(session_key=second_key).expire_date, expired)
        self.assertEqual(self.post("logout", {}).status_code, 204)
        self.assertFalse(Session.objects.filter(session_key=second_key).exists())

    def test_password_spaces_are_significant_and_invalid_input_does_not_consume_proof(self):
        proof = self.begin()
        for values in ({"username": "Kelvin", "password": PASSWORD},
                       {"username": "learner_one", "password": "short"},
                       {"username": "learner_one", "password": "learner_one!99"}):
            self.assertEqual(self.post("email-verify", {"token": proof, **values}).status_code, 400)
        spaced = " " + PASSWORD + " "
        self.assertEqual(self.post("email-verify", {"token": proof, "username": "learner_one", "password": spaced}).status_code, 200)
        self.client.logout()
        self.assertEqual(self.post("email-login", {"identifier": "learner_one", "password": PASSWORD}).status_code, 401)
        self.assertEqual(self.post("email-login", {"identifier": "learner_one", "password": spaced}).status_code, 200)

    def test_requests_are_neutral_without_smtp_and_unknown_reset_creates_no_pending_mail(self):
        with patch("accounts.email_auth.send_mail") as sender:
            unknown = self.post("email-reset-request", {"email": "unknown@example.test"})
            request = self.post("email-register", {"email": "learner@example.test"})
            sender.assert_not_called()
        self.assertEqual(unknown.status_code, request.status_code)
        self.assertEqual(unknown.json(), request.json())
        self.assertEqual(EmailChallenge.objects.count(), 1)
        proof = self.deliver()
        self.assertEqual(self.post("email-verify", {"token": proof, "username": "learner_one", "password": PASSWORD}).status_code, 200)
        existing = self.post("email-register", {"email": "learner@example.test"})
        self.assertEqual(existing.json(), request.json())
        self.assertEqual(EmailChallenge.objects.count(), 0)

    def test_token_signature_purpose_expiry_and_sent_state_are_enforced(self):
        self.post("email-register", {"email": "learner@example.test"})
        challenge = EmailChallenge.objects.get()
        signed = challenge.selector + "." + email_auth.proof_for(challenge.selector, challenge.purpose)
        body = {"token": signed, "username": "learner_one", "password": PASSWORD}
        self.assertEqual(self.post("email-verify", body).status_code, 400)
        proof = self.deliver()
        bad = proof[:-1] + ("0" if proof[-1] != "0" else "1")
        self.assertEqual(self.post("email-verify", {**body, "token": bad}).status_code, 400)
        self.assertEqual(self.post("email-reset-confirm", {"token": proof, "password": PASSWORD}).status_code, 400)
        EmailChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.post("email-verify", {**body, "token": proof}).status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_username_conflict_rolls_back_new_account_and_can_retry_same_proof(self):
        self.register()
        self.client.logout()
        proof = self.begin("other@example.test")
        failed = self.post("email-verify", {"token": proof, "username": "learner_one", "password": PASSWORD})
        self.assertEqual(failed.status_code, 400)
        self.assertEqual(failed.json()["code"], "invalid_registration")
        self.assertEqual(User.objects.count(), 1)
        retry = self.post("email-verify", {"token": proof, "username": "other_name", "password": PASSWORD})
        self.assertEqual(retry.status_code, 200, retry.content)
        self.assertEqual(User.objects.count(), 2)

    def test_reset_does_not_cancel_previous_mail_until_success_and_invalidates_all_sessions(self):
        user, _ = self.register()
        other = APIClient(enforce_csrf_checks=True)
        self.assertEqual(self.post("email-login", {"identifier": "learner_one", "password": PASSWORD}, other).status_code, 200)
        self.assertEqual(self.post("email-reset-request", {"email": "learner@example.test"}).status_code, 202)
        proof = self.deliver()
        self.post("email-reset-request", {"email": "learner@example.test"})
        self.assertEqual(EmailChallenge.objects.filter(purpose="reset").count(), 2)
        response = self.post("email-reset-confirm", {"token": proof, "password": NEXT_PASSWORD})
        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(EmailChallenge.objects.filter(purpose="reset").exists())
        self.assertEqual(other.get(reverse("accounts:me")).status_code, 403)
        self.assertNotIn("_auth_user_id", self.client.session)
        self.assertEqual(self.post("email-reset-confirm", {"token": proof, "password": PASSWORD}).status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password(NEXT_PASSWORD))

    def telegram_login(self, client=None):
        identity = SimpleNamespace(telegram_id=9917001, display_name="Имя Telegram", username="tg_name", oidc_subject=None)
        with patch("accounts.views.validate_mini_app", return_value=identity):
            response = self.post("mini-app", {"init_data": "synthetic-init-data"}, client)
        self.assertEqual(response.status_code, 200, response.content)
        return User.objects.get(pk=response.json()["user"]["id"])

    def test_link_requires_recent_actual_telegram_and_preserves_account_and_profile(self):
        user = self.telegram_login()
        user.is_customer = True
        user.save(update_fields=["is_customer"])
        response = self.post("email-link", {"email": "linked@example.test"})
        self.assertEqual(response.status_code, 202, response.content)
        proof = self.deliver()
        response = self.post("email-verify", {"token": proof, "username": "linked_name", "password": PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["user"]["id"], user.pk)
        user.refresh_from_db()
        self.assertTrue(user.is_customer)
        self.assertEqual(user.display_name, "Имя Telegram")
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(EmailCredential.objects.get().user_id, user.pk)
        self.assertNotIn(email_auth.TELEGRAM_PROOF, self.client.session)
        self.assertEqual(self.post("email-link", {"email": "another@example.test"}).status_code, 403)

    def test_link_proof_is_bound_to_same_session_owner_and_recent_telegram_time(self):
        user = self.telegram_login()
        session = self.client.session
        session[email_auth.TELEGRAM_PROOF] = {"user_id": user.pk, "at": (timezone.now() - timedelta(minutes=11)).timestamp()}
        session.save()
        self.assertEqual(self.post("email-link", {"email": "linked@example.test"}).status_code, 403)
        self.telegram_login()
        self.assertEqual(self.post("email-link", {"email": "linked@example.test"}).status_code, 202)
        proof = self.deliver()
        other = APIClient(enforce_csrf_checks=True)
        response = self.post("email-verify", {"token": proof, "username": "linked_name", "password": PASSWORD}, other)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(EmailCredential.objects.exists())

    def test_staff_and_superuser_cannot_use_password_channel_or_reset(self):
        user, _ = self.register()
        self.client.logout()
        for flag in ("is_staff", "is_superuser"):
            setattr(user, flag, True)
            user.save(update_fields=[flag])
            result = self.post("email-login", {"identifier": "learner_one", "password": PASSWORD})
            self.assertEqual(result.status_code, 401)
            self.assertEqual(self.post("email-reset-request", {"email": "learner@example.test"}).status_code, 202)
            self.assertFalse(EmailChallenge.objects.exists())
            setattr(user, flag, False)
            user.save(update_fields=[flag])

    def test_rate_is_db_backed_and_email_username_share_account_bucket(self):
        self.register()
        self.client.logout()
        for index in range(10):
            identifier = "learner@example.test" if index % 2 else "learner_one"
            self.assertEqual(self.post("email-login", {"identifier": identifier, "password": NEXT_PASSWORD}).status_code, 401)
        denied = self.post("email-login", {"identifier": "learner_one", "password": PASSWORD})
        self.assertEqual(denied.status_code, 429)
        self.assertGreater(int(denied["Retry-After"]), 0)
        self.assertTrue(EmailAttempt.objects.exists())
        self.assertTrue(all(len(value) == 64 for value in EmailAttempt.objects.values_list("key", flat=True)))
        EmailAttempt.objects.update(window_started_at=timezone.now() - timedelta(hours=2))
        self.assertEqual(self.post("email-login", {"identifier": "learner_one", "password": PASSWORD}).status_code, 200)

    def test_synthetic_domain_unicode_and_unknown_fields_are_rejected_without_delivery(self):
        for email in ("real@example.com", "Kelvin@example.test", "test@пример.рф"):
            self.assertEqual(self.post("email-register", {"email": email}).status_code, 400)
        self.assertEqual(self.post("email-register", {"email": "a@example.test", "password": PASSWORD}).status_code, 400)
        self.assertFalse(EmailChallenge.objects.exists())

    def test_rate_clock_rollback_never_resets_an_existing_window(self):
        from django.utils.crypto import salted_hmac
        request = RequestFactory().post("/", REMOTE_ADDR="127.0.0.1")
        clock = timezone.now()
        key = salted_hmac("studly.email-attempt", "clock-test:subject:target", algorithm="sha256").hexdigest()
        row = EmailAttempt.objects.create(key=key, window_started_at=clock + timedelta(seconds=5), count=10)
        with patch("accounts.email_auth.timezone.now", return_value=clock):
            with self.assertRaises(email_auth.EmailError) as denied:
                email_auth.throttle(request, "clock-test", "target", ip_limit=100, subject_limit=10, seconds=900)
        self.assertEqual(denied.exception.status, 429)
        row.refresh_from_db()
        self.assertEqual(row.count, 10)
        self.assertEqual(row.window_started_at, clock + timedelta(seconds=5))

    def test_forwarded_ip_is_only_used_for_explicit_trusted_local_proxy(self):
        factory = RequestFactory()
        request = factory.post("/", REMOTE_ADDR="203.0.113.1", HTTP_X_FORWARDED_FOR="198.51.100.1, 198.51.100.2")
        with override_settings(STUDLY_EMAIL_TRUST_NGINX=True):
            self.assertEqual(email_auth.client_ip(request), "203.0.113.1")
            request.META["REMOTE_ADDR"] = "127.0.0.1"
            self.assertEqual(email_auth.client_ip(request), "198.51.100.2")
        with override_settings(STUDLY_EMAIL_TRUST_NGINX=False):
            self.assertEqual(email_auth.client_ip(request), "127.0.0.1")

    def test_options_linking_requires_configured_telegram_channel(self):
        with override_settings(TELEGRAM_BOT_TOKEN=""), patch("accounts.views.oidc_client", side_effect=TelegramNotConfigured):
            options = self.client.get(reverse("accounts:options")).json()
            self.assertTrue(options["email_login"])
            self.assertTrue(options["email_registration"])
            self.assertFalse(options["email_linking"])
        with override_settings(TELEGRAM_BOT_TOKEN="synthetic-test-token"), patch("accounts.views.oidc_client", side_effect=TelegramNotConfigured):
            self.assertTrue(self.client.get(reverse("accounts:options")).json()["email_linking"])
        with override_settings(TELEGRAM_BOT_TOKEN=""), patch("accounts.views.oidc_client", return_value=object()):
            self.assertTrue(self.client.get(reverse("accounts:options")).json()["email_linking"])

    def test_all_anonymous_post_routes_require_csrf_and_disabled_feature_fails_closed(self):
        names = ("email-register", "email-verify", "email-login", "email-reset-request", "email-reset-confirm", "email-link")
        for name in names:
            client = APIClient(enforce_csrf_checks=True)
            self.assertEqual(client.post(reverse("accounts:" + name), {}, format="json").status_code, 403)
        with override_settings(STUDLY_EMAIL_AUTH_ENABLED=False):
            for name in names:
                self.assertEqual(self.post(name, {}).status_code, 503)
            options = self.client.get(reverse("accounts:options")).json()
            self.assertFalse(options["email_login"])
            self.assertFalse(options["email_registration"])
            self.assertFalse(options["email_linking"])


@override_settings(
    STUDLY_EMAIL_AUTH_ENABLED=True,
    STUDLY_EMAIL_ACTION_URL="https://studly.example.test/auth/email",
    STUDLY_EMAIL_TEST_DOMAIN="example.test",
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class ConcurrentEmailAuthTests(TransactionTestCase):
    """Real separate transactions: unique conflicts must never leave orphan Users."""
    def challenge(self, email, purpose="register", user=None):
        import secrets
        row = EmailChallenge.objects.create(email=email, purpose=purpose, user=user, selector=secrets.token_hex(32),
                expires_at=timezone.now() + timedelta(minutes=30), sent_at=timezone.now())
        return row.selector + "." + email_auth.proof_for(row.selector, row.purpose)

    def race(self, route, bodies):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import connections
        barrier = Barrier(len(bodies))
        def call(body):
            connections.close_all()
            try:
                client = APIClient(enforce_csrf_checks=True)
                token = client.get(reverse("accounts:csrf")).json()["csrf_token"]
                barrier.wait(timeout=10)
                response = client.post(reverse("accounts:" + route), body, format="json", HTTP_X_CSRFTOKEN=token)
                return response.status_code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(bodies)) as pool:
            futures = [pool.submit(call, body) for body in bodies]
            return [future.result(timeout=30) for future in futures]

    def test_same_proof_is_consumed_once(self):
        proof = self.challenge("one@example.test")
        body = {"token": proof, "username": "one_name", "password": PASSWORD}
        self.assertEqual(sorted(self.race("email-verify", [body, body])), [200, 400])
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(EmailCredential.objects.count(), 1)

    def test_distinct_proofs_same_email_do_not_deadlock_or_duplicate_account(self):
        first = self.challenge("one@example.test")
        second = self.challenge("one@example.test")
        bodies = [{"token": first, "username": "first_name", "password": PASSWORD},
                  {"token": second, "username": "second_name", "password": PASSWORD}]
        self.assertEqual(sorted(self.race("email-verify", bodies)), [200, 400])
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(EmailCredential.objects.count(), 1)

    def test_username_unique_conflict_does_not_leave_orphan_user(self):
        bodies = [{"token": self.challenge(email), "username": "shared_name", "password": PASSWORD}
                  for email in ("one@example.test", "two@example.test")]
        self.assertEqual(sorted(self.race("email-verify", bodies)), [200, 400])
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(EmailCredential.objects.count(), 1)

    def test_parallel_reset_consumes_all_outstanding_proofs_for_account(self):
        user = User(telegram_id=None)
        user.set_password(PASSWORD)
        user.save()
        EmailCredential.objects.create(user=user, email="one@example.test", username="one_name", verified_at=timezone.now())
        bodies = [{"token": self.challenge("one@example.test", purpose="reset", user=user), "password": value}
                  for value in (NEXT_PASSWORD, "R8!valley-Cat-second")]
        self.assertEqual(sorted(self.race("email-reset-confirm", bodies)), [204, 400])
        self.assertFalse(EmailChallenge.objects.filter(user=user, purpose="reset").exists())
