"""Opt-in, synthetic-only environment. Never point this at the working database."""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403


env_path = Path(os.environ.get("STUDLY_ENV_FILE", "")).resolve()
if not os.environ.get("STUDLY_ENV_FILE") or not env_path.is_file() or env_path == (BASE_DIR / ".env").resolve():  # noqa: F405
    raise ImproperlyConfigured("Live test requires a separate STUDLY_ENV_FILE.")
if os.environ.get("STUDLY_LIVE_TEST_CONFIRM") != "isolated-synthetic-only":  # noqa: F405
    raise ImproperlyConfigured("Explicit synthetic-only confirmation is required.")
database = DATABASES.get("default", {})  # noqa: F405
if not str(database.get("NAME", "")).startswith("studly_live_test") or not str(database.get("USER", "")).startswith("studly_live_test"):
    raise ImproperlyConfigured("Use a dedicated studly_live_test database and role.")
if not os.environ.get("DJANGO_MEDIA_ROOT") or Path(MEDIA_ROOT).name != "live-test-media":  # noqa: F405
    raise ImproperlyConfigured("Use a separate directory ending in live-test-media.")
if YOOKASSA_TEST_SECRET_KEY or YOOKASSA_TEST_SHOP_ID:  # noqa: F405
    raise ImproperlyConfigured("Payment credentials are forbidden on the synthetic test stand.")
if any(os.environ.get(key) for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_OIDC_CLIENT_ID",
        "TELEGRAM_OIDC_CLIENT_SECRET", "TELEGRAM_OIDC_REDIRECT_URI")):
    raise ImproperlyConfigured("Real Telegram credentials are forbidden on the synthetic test stand.")

STUDLY_LIVE_TEST_ENABLED = True
SESSION_COOKIE_NAME = "studly_live_sessionid"
CSRF_COOKIE_NAME = "studly_live_csrftoken"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = not DEBUG  # noqa: F405
SECURE_HSTS_SECONDS = 3600 if not DEBUG else 0  # noqa: F405
STATIC_URL = "/django-static/"
STATIC_ROOT = Path(os.environ.get("DJANGO_STATIC_ROOT", BASE_DIR / "staticfiles"))  # noqa: F405
