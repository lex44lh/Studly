"""Настройки Backend STUDLY. Секреты задаются окружением или локальным .env."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)

DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
DEVELOPMENT_SECRET_KEY = (
    "django-insecure-studly-local-development-only-not-for-production"
)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", DEVELOPMENT_SECRET_KEY)
if not SECRET_KEY or (not DEBUG and SECRET_KEY == DEVELOPMENT_SECRET_KEY):
    raise ImproperlyConfigured(
        "Задайте DJANGO_SECRET_KEY. Ключ по умолчанию допустим только для разработки."
    )

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]"
    ).split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "health",
    "accounts",
    "catalog",
    "orders",
    "payments",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))

# Health остаётся доступен без БД; пользователям и сессиям нужна PostgreSQL.
DATABASES = {}
if os.environ.get("POSTGRES_DB"):
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ.get("POSTGRES_USER", "studly"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "OPTIONS": {"connect_timeout": 5},
    }

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
if DEBUG:
    # Служебный просмотр API при разработке; JSON остаётся основным форматом.
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"].append(
        "rest_framework.renderers.BrowsableAPIRenderer"
    )

AUTH_USER_MODEL = "accounts.User"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = "Lax"
# Явно фиксируем действовавшие значения Django: без продления от чтения API.
SESSION_COOKIE_AGE = 14 * 24 * 60 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = False
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = not DEBUG
CSRF_FAILURE_VIEW = "accounts.views.csrf_failure"
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_AUTH_MAX_AGE = int(os.environ.get("TELEGRAM_AUTH_MAX_AGE", "300"))
TELEGRAM_AUTH_CLOCK_SKEW = int(os.environ.get("TELEGRAM_AUTH_CLOCK_SKEW", "30"))
TELEGRAM_OIDC_CLIENT_ID = os.environ.get("TELEGRAM_OIDC_CLIENT_ID", "")
TELEGRAM_OIDC_CLIENT_SECRET = os.environ.get("TELEGRAM_OIDC_CLIENT_SECRET", "")
TELEGRAM_OIDC_REDIRECT_URI = os.environ.get("TELEGRAM_OIDC_REDIRECT_URI", "")
TELEGRAM_OIDC_STATE_MAX_AGE = int(os.environ.get("TELEGRAM_OIDC_STATE_MAX_AGE", "300"))
if min(TELEGRAM_AUTH_MAX_AGE, TELEGRAM_OIDC_STATE_MAX_AGE) <= 0 or TELEGRAM_AUTH_CLOCK_SKEW < 0:
    raise ImproperlyConfigured("Сроки проверки Telegram должны быть положительными.")

YOOKASSA_TEST_SHOP_ID = os.environ.get("YOOKASSA_TEST_SHOP_ID", "")
YOOKASSA_TEST_SECRET_KEY = os.environ.get("YOOKASSA_TEST_SECRET_KEY", "")

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
