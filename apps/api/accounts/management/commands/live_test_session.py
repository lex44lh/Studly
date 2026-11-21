"""Private CLI session issuance; there is no HTTP test-login endpoint."""
import os
from importlib import import_module
from pathlib import Path

from django.conf import settings
from django.contrib.auth import SESSION_KEY, BACKEND_SESSION_KEY, HASH_SESSION_KEY
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from .seed_live_test import ACTORS, PREFIX, require_test_stand, validate_actor


class Command(BaseCommand):
    help = "Write a short-lived synthetic actor cookie to a new private Netscape cookie file."

    def add_arguments(self, parser):
        parser.add_argument("--actor", choices=ACTORS, required=True)
        parser.add_argument("--host", required=True)
        parser.add_argument("--cookie-file", required=True)

    def handle(self, *args, **options):
        require_test_stand()
        host = options["host"]
        if host not in settings.ALLOWED_HOSTS or any(c in host for c in "\t\r\n/:"):
            raise CommandError("Use an explicit test hostname from DJANGO_ALLOWED_HOSTS.")
        try:
            user = User.objects.get(telegram_oidc_subject=PREFIX + options["actor"], is_active=True)
        except User.DoesNotExist as exc:
            raise CommandError("Run seed_live_test first.") from exc
        validate_actor(user, options["actor"])
        path = Path(options["cookie_file"])
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError as exc:
            raise CommandError("Cookie file already exists; it was not overwritten.") from exc
        try:
            session = import_module(settings.SESSION_ENGINE).SessionStore()
            session[SESSION_KEY] = str(user.pk)
            session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
            session[HASH_SESSION_KEY] = user.get_session_auth_hash()
            session.set_expiry(3600)
            session.save()
            secure = "TRUE" if settings.SESSION_COOKIE_SECURE else "FALSE"
            with os.fdopen(fd, "w") as output:
                output.write("# Netscape HTTP Cookie File\n")
                output.write(f"#HttpOnly_{host}\tFALSE\t/\t{secure}\t{int(session.get_expiry_date().timestamp())}\t{settings.SESSION_COOKIE_NAME}\t{session.session_key}\n")
        except Exception:
            path.unlink(missing_ok=True)
            raise
        self.stdout.write("Synthetic session issued for one hour. Cookie value was not printed.")
