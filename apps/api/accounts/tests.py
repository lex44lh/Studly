"""Проверки используют вымышленные данные и локальные ключи, без сети Telegram."""

import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
import time
from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlsplit

from django.conf import settings
from django.db import IntegrityError, connections, transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from joserfc import jwt
from joserfc.jwk import RSAKey
from requests import Response as HttpResponse
from requests.exceptions import Timeout
from rest_framework.test import APIClient

from .models import User
from .services import AccountUnavailable, resolve_user
from .telegram import InvalidTelegramData, TelegramIdentity, validate_mini_app
from .views import OIDC_PENDING

BOT_TOKEN = "123456:fake-token-only-for-tests"
TELEGRAM_ID = 2**40 + 123


def signed_init_data(user=None, **extra):
    fields = {
        "auth_date": str(int(time.time())),
        "user": user if isinstance(user, str) else json.dumps(user if user is not None else {
            "id": TELEGRAM_ID, "first_name": "Тестовый", "last_name": "Пользователь",
            "username": "studly_test",
        }, ensure_ascii=False, separators=(",", ":")),
        "query_id": "local-test-query",
        **extra,
    }
    check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.digest(b"WebAppData", BOT_TOKEN.encode(), "sha256")
    fields["hash"] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


@override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN, TELEGRAM_AUTH_MAX_AGE=300,
                   TELEGRAM_AUTH_CLOCK_SKEW=30)
class MiniAppValidationTests(SimpleTestCase):
    def test_valid_signed_unicode_profile_and_large_id(self):
        identity = validate_mini_app(signed_init_data())
        self.assertEqual(identity.telegram_id, TELEGRAM_ID)
        self.assertEqual(identity.display_name, "Тестовый Пользователь")
        self.assertEqual(identity.username, "studly_test")

    def test_signature_field_is_included_in_hmac(self):
        raw = signed_init_data(signature="new-telegram-signature")
        self.assertEqual(validate_mini_app(raw).telegram_id, TELEGRAM_ID)
        with self.assertRaises(InvalidTelegramData):
            validate_mini_app(raw.replace("new-telegram-signature", "changed"))

    def test_tampered_user_and_bad_signature_are_rejected(self):
        raw = signed_init_data()
        for invalid in (raw.replace(str(TELEGRAM_ID), "555"), raw[:-1] + ("0" if raw[-1] != "0" else "1")):
            with self.subTest(invalid=invalid), self.assertRaises(InvalidTelegramData):
                validate_mini_app(invalid)

    def test_invalid_dates_are_rejected(self):
        for date in (str(int(time.time()) - 301), str(int(time.time()) + 31), "", "tomorrow"):
            with self.subTest(date=date), self.assertRaises(InvalidTelegramData):
                validate_mini_app(signed_init_data(auth_date=date))

    def test_malformed_missing_and_duplicate_fields_are_rejected(self):
        raw = signed_init_data()
        for invalid in ("", "hash=wrong", "malformed", raw + "&auth_date=123", raw + "&hash=123",
                        signed_init_data(user="null"), signed_init_data(user="[]"),
                        signed_init_data(user="{broken"), "x=" + "a" * 16384):
            with self.subTest(invalid=invalid[:100]), self.assertRaises(InvalidTelegramData):
                validate_mini_app(invalid)

    def test_invalid_telegram_ids_are_rejected(self):
        for value in (None, True, "123", 0, -1, 2**63):
            with self.subTest(value=value), self.assertRaises(InvalidTelegramData):
                validate_mini_app(signed_init_data(user={"id": value}))

    def test_username_is_optional(self):
        identity = validate_mini_app(signed_init_data(user={"id": TELEGRAM_ID, "first_name": "Имя"}))
        self.assertEqual(identity.username, "")


class IdentityStorageTests(TestCase):
    def test_public_user_has_unusable_password_and_no_staff_permissions(self):
        user = resolve_user(TelegramIdentity(TELEGRAM_ID, "Имя", "name"))
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_same_id_is_same_account_and_username_does_not_identify_user(self):
        first = resolve_user(TelegramIdentity(TELEGRAM_ID, "Первое", "shared"))
        same = resolve_user(TelegramIdentity(TELEGRAM_ID, "Второе", "changed"))
        other = resolve_user(TelegramIdentity(TELEGRAM_ID + 1, "Первое", "shared"))
        self.assertEqual(first.pk, same.pk)
        self.assertNotEqual(first.pk, other.pk)
        self.assertEqual(User.objects.count(), 2)

    def test_oidc_and_mini_app_find_same_account_in_both_orders(self):
        for index, identities in enumerate((
            (TelegramIdentity(100, "Имя", ""), TelegramIdentity(100, "Имя", "", "subject-a")),
            (TelegramIdentity(200, "Имя", "", "subject-b"), TelegramIdentity(200, "Имя", "")),
        )):
            with self.subTest(index=index):
                first, second = [resolve_user(identity) for identity in identities]
                self.assertEqual(first.pk, second.pk)
                self.assertEqual(User.objects.get(pk=first.pk).telegram_oidc_subject, f"subject-{'ab'[index]}")

    def test_conflicting_subject_is_rejected_without_creating_another_account(self):
        resolve_user(TelegramIdentity(100, "Первый", "", "same-subject"))
        for identity in (TelegramIdentity(200, "Другой", "", "same-subject"),
                         TelegramIdentity(100, "Другой", "", "changed-subject")):
            with self.subTest(identity=identity), self.assertRaises(AccountUnavailable):
                resolve_user(identity)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().display_name, "Первый")

    def test_database_enforces_unique_and_positive_telegram_id(self):
        User.objects.create_user(TELEGRAM_ID)
        for value in (TELEGRAM_ID, 0, -1):
            with self.subTest(value=value), self.assertRaises(IntegrityError), transaction.atomic():
                User.objects.create(telegram_id=value)


@override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN)
class SessionEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf(self):
        response = self.client.get(reverse("accounts:csrf"))
        self.assertEqual(response.status_code, 200)
        return response.json()["csrf_token"]

    def sign_in(self, **extra):
        return self.client.post(reverse("accounts:mini-app"), {"init_data": signed_init_data(**extra)},
                                format="json", HTTP_X_CSRFTOKEN=self.csrf())

    def test_login_requires_csrf_even_before_user_is_authenticated(self):
        response = self.client.post(reverse("accounts:mini-app"), {"init_data": signed_init_data()}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "csrf_failed")
        self.assertFalse(User.objects.exists())

    def test_login_me_logout_and_session_cannot_be_reused(self):
        response = self.sign_in()
        self.assertEqual(response.status_code, 200)
        profile = response.json()["user"]
        self.assertEqual(set(profile), {"id", "display_name", "telegram_username"})
        self.assertEqual(self.client.get(reverse("accounts:me")).json()["user"], profile)
        old_session = self.client.cookies[settings.SESSION_COOKIE_NAME].value
        self.assertTrue(self.client.cookies[settings.SESSION_COOKIE_NAME]["httponly"])
        response = self.client.post(reverse("accounts:logout"), HTTP_X_CSRFTOKEN=self.csrf())
        self.assertEqual(response.status_code, 204)
        self.client.cookies[settings.SESSION_COOKIE_NAME] = old_session
        self.assertEqual(self.client.get(reverse("accounts:me")).status_code, 403)

    def test_login_rotates_session_and_csrf_token(self):
        initial_session = self.client.session.session_key
        old_csrf = self.csrf()
        self.assertEqual(self.sign_in().status_code, 200)
        self.assertNotEqual(self.client.cookies[settings.SESSION_COOKIE_NAME].value, initial_session)
        self.assertEqual(self.client.post(reverse("accounts:logout"), HTTP_X_CSRFTOKEN=old_csrf).status_code, 403)

    def test_logout_requires_csrf_and_rejects_get(self):
        self.sign_in()
        self.assertEqual(self.client.post(reverse("accounts:logout")).status_code, 403)
        self.assertEqual(self.client.get(reverse("accounts:logout")).status_code, 405)

    def test_anonymous_profile_is_denied(self):
        self.assertEqual(self.client.get(reverse("accounts:me")).status_code, 403)

    def test_invalid_proof_does_not_create_account_or_session(self):
        response = self.client.post(reverse("accounts:mini-app"), {"init_data": "hash=fake"},
                                    format="json", HTTP_X_CSRFTOKEN=self.csrf())
        self.assertEqual(response.status_code, 401)
        self.assertFalse(User.objects.exists())
        self.assertNotIn(settings.SESSION_COOKIE_NAME, self.client.cookies)

    def test_disabled_account_cannot_login_or_keep_existing_session(self):
        self.assertEqual(self.sign_in().status_code, 200)
        User.objects.update(is_active=False)
        self.assertEqual(self.client.get(reverse("accounts:me")).status_code, 403)
        self.assertEqual(self.sign_in().status_code, 403)

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_unconfigured_login_returns_service_unavailable(self):
        response = self.sign_in()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "telegram_not_configured")

    def test_profile_is_not_cached_and_no_client_selected_user(self):
        own = self.sign_in().json()["user"]
        other = User.objects.create_user(TELEGRAM_ID + 1)
        response = self.client.get(reverse("accounts:me"), {"user_id": other.pk})
        self.assertEqual(response.json()["user"], own)
        self.assertIn("no-store", response["Cache-Control"])


@override_settings(
    TELEGRAM_BOT_TOKEN=BOT_TOKEN,
    TELEGRAM_OIDC_CLIENT_ID="123456",
    TELEGRAM_OIDC_CLIENT_SECRET="fake-client-secret",
    TELEGRAM_OIDC_REDIRECT_URI="https://studly.test/api/v1/auth/telegram/callback/",
)
class OidcFlowTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.key = RSAKey.generate_key(2048, parameters={"kid": "local-test-key"})
        cls.other_key = RSAKey.generate_key(2048, parameters={"kid": "local-test-key"})

    def begin(self):
        response = self.client.get(reverse("accounts:oidc-start"))
        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlsplit(response["Location"]).query)
        self.nonce = query["nonce"][0]
        self.state = query["state"][0]
        return query

    def claims(self, **changes):
        return {"iss": "https://oauth.telegram.org", "aud": "123456", "sub": "oidc-subject",
                "id": TELEGRAM_ID, "iat": int(time.time()), "exp": int(time.time()) + 300,
                "nonce": self.nonce, "name": "Тестовый Пользователь", **changes}

    def exchange(self, claims=None, *, signing_key=None, algorithm="RS256", token_response=None):
        signed = jwt.encode({"alg": algorithm, "kid": "local-test-key"},
                            self.claims() if claims is None else claims, signing_key or self.key,
                            algorithms=[algorithm])
        payload = token_response if token_response is not None else {
            "access_token": "fake-access-token", "token_type": "Bearer", "id_token": signed,
        }
        sent = []

        def send(prepared, **kwargs):
            sent.append(prepared)
            self.assertEqual(kwargs["timeout"], 10)
            if prepared.url == "https://oauth.telegram.org/token":
                data = payload
            elif prepared.url == "https://oauth.telegram.org/.well-known/jwks.json":
                data = {"keys": [self.key.as_dict(private=False)]}
            else:
                raise AssertionError(f"Неожиданный запрос: {prepared.url}")
            response = HttpResponse()
            response.status_code = 200
            response.url = prepared.url
            response.headers["Content-Type"] = "application/json"
            response._content = json.dumps(data).encode()
            return response

        with patch("requests.sessions.Session.send", side_effect=send):
            response = self.client.get(reverse("accounts:oidc-callback"), {"state": self.state, "code": "fake-code"})
        return response, sent

    def test_start_and_callback_use_pkce_basic_auth_and_validated_id_token(self):
        query = self.begin()
        self.assertEqual(query["scope"], ["openid profile"])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        response, sent = self.exchange()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(User.objects.get().telegram_oidc_subject, "oidc-subject")
        token_request = sent[0]
        credentials = base64.b64decode(token_request.headers["Authorization"].split()[1]).decode()
        self.assertEqual(credentials, "123456:fake-client-secret")
        body = parse_qs(token_request.body)
        self.assertEqual(body["grant_type"], ["authorization_code"])
        self.assertEqual(body["redirect_uri"], [settings.TELEGRAM_OIDC_REDIRECT_URI])
        verifier = body["code_verifier"][0]
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        self.assertEqual(challenge, query["code_challenge"][0])
        self.assertEqual(self.client.get(reverse("accounts:me")).json(), response.json())
        self.assertEqual(self.client.get(reverse("accounts:oidc-callback"), {"state": self.state, "code": "fake-code"}).status_code, 400)

    def test_invalid_signature_and_wrong_algorithm_are_rejected(self):
        for key, algorithm in ((self.other_key, "RS256"), (self.key, "RS512")):
            with self.subTest(algorithm=algorithm):
                self.begin()
                response, _ = self.exchange(signing_key=key, algorithm=algorithm)
                self.assertEqual(response.status_code, 401, response.content)
                self.assertFalse(User.objects.exists())

    def test_wrong_claims_and_missing_required_claims_are_rejected(self):
        for field, value in (("iss", "https://attacker.test"), ("aud", "other-client"),
                             ("nonce", "different"), ("exp", int(time.time()) - 3600),
                             ("iat", int(time.time()) + 3600), ("id", "untrusted-string"),
                             ("sub", ""), ("nonce", None), ("exp", None), ("id", None)):
            with self.subTest(field=field, value=value):
                self.begin()
                claims = self.claims(**{field: value})
                if value is None:
                    claims.pop(field)
                response, _ = self.exchange(claims)
                self.assertEqual(response.status_code, 401, response.content)
                self.assertFalse(User.objects.exists())

    def test_wrong_state_is_rejected_before_network_access(self):
        self.begin()
        with patch("requests.sessions.Session.send") as send:
            for state in ("wrong", "", "неверный"):
                response = self.client.get(reverse("accounts:oidc-callback"), {"state": state, "code": "fake"})
                self.assertEqual(response.status_code, 400)
            send.assert_not_called()

    def test_expired_state_is_rejected(self):
        self.begin()
        session = self.client.session
        session[OIDC_PENDING]["created_at"] = time.time() - 3600
        session.save()
        self.assertEqual(self.client.get(reverse("accounts:oidc-callback"), {"state": self.state, "code": "fake"}).status_code, 400)

    def test_missing_id_token_does_not_login(self):
        self.begin()
        response, _ = self.exchange(token_response={"access_token": "fake", "token_type": "Bearer"})
        self.assertEqual(response.status_code, 401)
        self.assertFalse(User.objects.exists())

    def test_network_failure_denies_login_without_crashing(self):
        self.begin()
        with patch("requests.sessions.Session.send", side_effect=Timeout):
            response = self.client.get(reverse("accounts:oidc-callback"), {"state": self.state, "code": "fake"})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(User.objects.exists())

    def test_mini_app_and_oidc_endpoints_share_one_user(self):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        first = self.client.post(reverse("accounts:mini-app"), {"init_data": signed_init_data()},
                                 content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(first.status_code, 200)
        self.begin()
        second, _ = self.exchange()
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["user"]["id"], second.json()["user"]["id"])
        self.assertEqual(User.objects.count(), 1)

    @override_settings(TELEGRAM_OIDC_CLIENT_SECRET="")
    def test_missing_configuration_disables_oidc(self):
        self.assertEqual(self.client.get(reverse("accounts:oidc-start")).status_code, 503)


class ConcurrentIdentityTests(TransactionTestCase):
    def test_concurrent_first_logins_create_one_user(self):
        identity = TelegramIdentity(TELEGRAM_ID, "Имя", "test")

        def sign_in(_):
            try:
                return resolve_user(identity).pk
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(sign_in, range(2)))
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(User.objects.count(), 1)
