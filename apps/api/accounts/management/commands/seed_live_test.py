"""Synthetic fixtures only; no external identity or payment is simulated."""
import json
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.conf import settings
from django.utils import timezone

from accounts.models import User, PerformerProfile, PortfolioExample, RegistrationProgress, Specialization
from catalog.models import Service


ACTORS = ("buyer", "performer", "moderator", "outsider")
PREFIX = "urn:studly:live-test:"


def require_test_stand():
    if not getattr(settings, "STUDLY_LIVE_TEST_ENABLED", False):
        raise CommandError("Only config.live_test may create synthetic fixtures/sessions.")


def validate_actor(user, role):
    expected = (role in ("buyer", "outsider"), role == "performer", role == "moderator")
    if (user.telegram_id is not None or user.has_usable_password() or user.is_superuser
            or not user.is_active or not user.display_name.startswith("[ТЕСТ]")
            or (user.is_customer, user.is_performer, user.is_staff) != expected):
        raise CommandError("Synthetic actor marker collision; refusing access or mutation.")


def prepare_test_service(performer, fixture_key, *, title):
    # Serialize repeated fixture setup. Existing fixture edits are not overwritten.
    User.objects.select_for_update().get(pk=performer.pk)
    profile, _ = PerformerProfile.objects.get_or_create(user=performer, defaults={
        "description": "Синтетический профиль для проверки API; не реальная услуга.",
        "moderation_status": "approved",
    })
    specialization, _ = Specialization.objects.get_or_create(title="[ТЕСТ] Проверка интеграции")
    profile.specializations.add(specialization)
    portfolio_key = "portfolio" if fixture_key == "live-test-v1" else f"{fixture_key}:portfolio"
    example, _ = PortfolioExample.objects.get_or_create(
        pk=uuid5(NAMESPACE_URL, PREFIX + portfolio_key),
        defaults={"profile": profile, "title": "[ТЕСТ] Пример", "url": "https://example.invalid/studly-test"},
    )
    service, created = Service.objects.get_or_create(demo_key=fixture_key, defaults={
        "performer": performer, "title": title,
        "description": "Только синтетический сценарий интеграции. Оплата не подключена.",
        "category": "[ТЕСТ] Проверка интеграции", "included": ["Тестовая консультация"],
        "price_amount": Decimal("100.00"), "duration_days": 1, "status": "published", "is_demo": False,
    })
    if service.performer_id != performer.pk or service.is_demo or example.profile_id != profile.pk:
        raise CommandError("Fixture marker collision; existing data were not changed.")
    if created:
        service.portfolio_examples.add(example)
    return service


class Command(BaseCommand):
    help = "Create repeatable synthetic Live fixtures on an explicitly isolated stand."

    @transaction.atomic
    def handle(self, *args, **options):
        require_test_stand()
        actors = {}
        for role in ACTORS:
            user, _ = User.objects.get_or_create(telegram_oidc_subject=PREFIX + role, defaults={
                "telegram_id": None, "password": make_password(None),
                "display_name": f"[ТЕСТ] {role}", "is_active": True,
                "is_customer": role in ("buyer", "outsider"),
                "is_performer": role == "performer", "is_staff": role == "moderator",
            })
            validate_actor(user, role)
            actors[role] = user
            RegistrationProgress.objects.get_or_create(user=user, defaults={"completed_at": timezone.now()})
        service = prepare_test_service(actors["performer"], "live-test-v1", title="[ТЕСТ] Консультация по Python")
        permissions = Permission.objects.filter(
            content_type__app_label="accounts", codename="moderate_performer",
        ) | Permission.objects.filter(content_type__app_label="catalog", codename="moderate_service") | Permission.objects.filter(
            content_type__app_label="conversations", codename="review_security_case",
        )
        actors["moderator"].user_permissions.add(*permissions)
        self.stdout.write(json.dumps({"synthetic_only": True,
            "actors": {role: user.pk for role, user in actors.items()}, "service_id": service.pk,
            "payment_enabled": False}, ensure_ascii=False))
