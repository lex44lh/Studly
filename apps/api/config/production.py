"""Настройки VPS: Django доступен только через доверенный локальный Nginx."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403


if DEBUG:  # noqa: F405
    raise ImproperlyConfigured("Production требует DJANGO_DEBUG=false.")
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("Production требует явный DJANGO_ALLOWED_HOSTS.")

# Nginx обязан перезаписывать этот заголовок. Gunicorn слушает Unix-сокет,
# недоступный из интернета; прямой публичный доступ к нему запрещён.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

if STUDLY_EMAIL_AUTH_ENABLED:  # noqa: F405
    EMAIL_HOST = os.environ.get("STUDLY_EMAIL_SMTP_HOST", "")
    EMAIL_HOST_USER = os.environ.get("STUDLY_EMAIL_SMTP_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("STUDLY_EMAIL_SMTP_PASSWORD", "")
    if not all((EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, os.environ.get("STUDLY_EMAIL_FROM"))):
        raise ImproperlyConfigured("Email authentication on production requires an explicitly configured SMTP account and sender.")
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    STUDLY_EMAIL_TRUST_NGINX = True

# Отдельный префикс служебной статики Django не занимает пути Next.js.
STATIC_URL = "/django-static/"
STATIC_ROOT = Path(os.environ.get("DJANGO_STATIC_ROOT", "/srv/studly/static"))
