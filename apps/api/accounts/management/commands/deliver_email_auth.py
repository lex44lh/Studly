"""Deliver pending account emails outside of HTTP requests."""

from datetime import timedelta
from smtplib import SMTPException

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.email_auth import send_challenge_email
from accounts.models import EmailAttempt, EmailChallenge


class Command(BaseCommand):
    help = "Send pending account emails and purge expired authentication records."

    def handle(self, *args, **options):
        if not settings.STUDLY_EMAIL_AUTH_ENABLED:
            raise CommandError("Email authentication is disabled.")

        now = timezone.now()
        EmailChallenge.objects.filter(expires_at__lte=now).delete()
        EmailAttempt.objects.filter(window_started_at__lte=now - timedelta(hours=24)).delete()
        pending = EmailChallenge.objects.filter(sent_at__isnull=True).order_by("expires_at", "pk")
        candidate_ids = list(pending.values_list("pk", flat=True)[:20])
        delivered = failed = 0
        for candidate_id in candidate_ids:
            with transaction.atomic():
                challenge = pending.select_for_update(skip_locked=True).filter(
                    pk=candidate_id, expires_at__gt=timezone.now(),
                ).first()
                if challenge is None:
                    continue
                try:
                    sent = send_challenge_email(challenge)
                except (OSError, SMTPException):
                    sent = False
                if sent:
                    challenge.sent_at = timezone.now()
                    challenge.save(update_fields=["sent_at"])
                    delivered += 1
                else:
                    failed += 1

        self.stdout.write(f"Account emails delivered: {delivered}; deferred: {failed}")
        if failed:
            raise CommandError("Some account emails could not be delivered and will be retried.")
