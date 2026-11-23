"""Prepare the two named, ordinary rehearsal accounts on the synthetic stand."""

import json
import os
import secrets
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.models import EmailCredential, RegistrationProgress, User
from .seed_live_test import prepare_test_service, require_test_stand


class Command(BaseCommand):
    help = "Create synthetic buyer/performer logins and write credentials to a new private file."

    def add_arguments(self, parser):
        parser.add_argument("--credentials-file", type=Path, required=True)

    def handle(self, *args, **options):
        require_test_stand()
        if not settings.STUDLY_EMAIL_AUTH_ENABLED or settings.STUDLY_EMAIL_TEST_DOMAIN != "example.test":
            raise CommandError("Enable email authentication on the synthetic test domain first.")

        path = options["credentials_file"]
        if not path.is_absolute() or not path.parent.is_dir() or path.parent.stat().st_mode & 0o077:
            raise CommandError("Use an absolute credentials path in a private (0700) directory.")
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            raise CommandError("Credentials file already exists.") from None

        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as output, transaction.atomic():
                accounts = {}
                users = {}
                now = timezone.now()
                for role, name in (("buyer", "Заказчик"), ("performer", "Исполнитель")):
                    username = f"live-{role}"
                    email = f"{username}@example.test"
                    password = secrets.token_urlsafe(32)
                    user = User(display_name=f"[ТЕСТ] {name}", is_customer=role == "buyer", is_performer=role == "performer")
                    user.set_password(password)
                    user.save()
                    EmailCredential.objects.create(user=user, email=email, username=username, verified_at=now)
                    RegistrationProgress.objects.create(user=user, completed_at=now)
                    users[role] = user
                    accounts[role] = {"email": email, "username": username, "password": password}
                service = prepare_test_service(users["performer"], "live-email-test-v1",
                                               title="[ТЕСТ] Консультация для совместного прогона")
                json.dump({"accounts": accounts, "service_id": service.pk}, output, ensure_ascii=False, indent=2)
                output.flush()
        except IntegrityError:
            path.unlink(missing_ok=True)
            raise CommandError("A test login already exists. Use the isolated password reset procedure.") from None
        except Exception:
            path.unlink(missing_ok=True)
            raise
        self.stdout.write("Created two synthetic logins; credentials were written only to the private file.")
