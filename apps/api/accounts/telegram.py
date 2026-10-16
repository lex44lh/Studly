"""Проверка доказательств входа. Здесь нет запросов к нашей базе данных."""

from dataclasses import dataclass
import hashlib
import hmac
import json
import re
import time
from urllib.parse import parse_qsl, urlsplit

from authlib.integrations.django_client import OAuth
from django.conf import settings

TELEGRAM_ISSUER = "https://oauth.telegram.org"


class InvalidTelegramData(ValueError):
    pass


class TelegramNotConfigured(Exception):
    pass


@dataclass(frozen=True)
class TelegramIdentity:
    telegram_id: int
    display_name: str
    username: str
    oidc_subject: str | None = None


def _identity(telegram_id, name, username, subject=None):
    if type(telegram_id) is not int or not 0 < telegram_id <= 2**63 - 1:
        raise InvalidTelegramData("Некорректный Telegram ID.")
    if not isinstance(name, str) or len(name) > 255:
        raise InvalidTelegramData("Некорректное имя.")
    if not isinstance(username, str) or len(username) > 64:
        raise InvalidTelegramData("Некорректный username.")
    return TelegramIdentity(telegram_id, name, username, subject)


def validate_mini_app(init_data, *, now=None):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramNotConfigured
    if not isinstance(init_data, str) or not init_data or len(init_data) > 16384:
        raise InvalidTelegramData("Некорректные данные запуска.")
    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True,
                          encoding="utf-8", errors="strict", max_num_fields=32)
    except (ValueError, UnicodeError) as exc:
        raise InvalidTelegramData("Некорректные данные запуска.") from exc
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise InvalidTelegramData("Повторяющиеся поля.")
    received_hash = fields.pop("hash", "")
    if not re.fullmatch(r"[0-9a-f]{64}", received_hash):
        raise InvalidTelegramData("Некорректная подпись.")
    # В проверке HMAC исключается только hash; новое поле signature тоже подписано.
    check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.digest(b"WebAppData", settings.TELEGRAM_BOT_TOKEN.encode(), "sha256")
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(received_hash, expected):
        raise InvalidTelegramData("Некорректная подпись.")
    auth_date = fields.get("auth_date", "")
    if not re.fullmatch(r"[0-9]{1,12}", auth_date):
        raise InvalidTelegramData("Отсутствует время входа.")
    age = (time.time() if now is None else now) - int(auth_date)
    if age > settings.TELEGRAM_AUTH_MAX_AGE or age < -settings.TELEGRAM_AUTH_CLOCK_SKEW:
        raise InvalidTelegramData("Данные входа устарели или выданы в будущем.")
    try:
        user = json.loads(fields["user"])
    except (KeyError, ValueError) as exc:
        raise InvalidTelegramData("Отсутствуют данные пользователя.") from exc
    if not isinstance(user, dict):
        raise InvalidTelegramData("Некорректные данные пользователя.")
    first, last = user.get("first_name", ""), user.get("last_name", "")
    if not isinstance(first, str) or not isinstance(last, str):
        raise InvalidTelegramData("Некорректное имя.")
    return _identity(user.get("id"), f"{first} {last}".strip(), user.get("username", ""))


def identity_from_oidc(claims):
    # Вызывается только для userinfo, уже проверенного Authlib, не для тела запроса.
    if not isinstance(claims, dict):
        raise InvalidTelegramData("Отсутствуют проверенные данные OIDC.")
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise InvalidTelegramData("Отсутствует идентификатор OIDC.")
    return _identity(claims.get("id"), claims.get("name", ""),
                     claims.get("preferred_username", ""), subject)


def oidc_client():
    redirect = urlsplit(settings.TELEGRAM_OIDC_REDIRECT_URI)
    valid_redirect = redirect.scheme == "https" or (
        settings.DEBUG and redirect.scheme == "http" and redirect.hostname in {"127.0.0.1", "localhost"}
    )
    if not (settings.TELEGRAM_OIDC_CLIENT_ID and settings.TELEGRAM_OIDC_CLIENT_SECRET
            and valid_redirect and redirect.netloc and not redirect.fragment):
        raise TelegramNotConfigured
    # Фиксированные адреса Telegram: без UserInfo-запроса и доверия адресам клиента.
    return OAuth().register(
        "telegram",
        client_id=settings.TELEGRAM_OIDC_CLIENT_ID,
        client_secret=settings.TELEGRAM_OIDC_CLIENT_SECRET,
        authorize_url=f"{TELEGRAM_ISSUER}/auth",
        access_token_url=f"{TELEGRAM_ISSUER}/token",
        jwks_uri=f"{TELEGRAM_ISSUER}/.well-known/jwks.json",
        issuer=TELEGRAM_ISSUER,
        id_token_signing_alg_values_supported=["RS256"],
        client_kwargs={"scope": "openid profile", "code_challenge_method": "S256",
                       "token_endpoint_auth_method": "client_secret_basic", "default_timeout": 10},
    )
