from datetime import timedelta

from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class EmailIdentityMigrationTests(TransactionTestCase):
    old_target = [
        ("accounts", "0004_portfolioexample_alter_performerprofile_options_and_more"),
    ]

    def test_legacy_identity_is_preserved_and_new_credentials_are_constrained(self):
        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        executor.migrate(self.old_target)
        try:
            old_user = executor.loader.project_state(self.old_target).apps.get_model("accounts", "User")
            first = old_user.objects.create(
                telegram_id=971001, telegram_oidc_subject="legacy-email-migration",
                telegram_username="shared", email="Legacy@Example.com",
                password="!legacy-unusable", display_name="Legacy account", is_customer=True,
            )
            second = old_user.objects.create(
                telegram_id=971002, telegram_username="shared", email="legacy@example.com",
                password="!another-unusable", display_name="Other account", is_performer=True,
            )
            old_user.objects.create(telegram_id=None, is_active=False, display_name="Demo")
            before = list(old_user.objects.order_by("pk").values())

            executor = MigrationExecutor(connection)
            executor.migrate(targets)
            apps = executor.loader.project_state(targets).apps
            user = apps.get_model("accounts", "User")
            credential = apps.get_model("accounts", "EmailCredential")
            challenge = apps.get_model("accounts", "EmailChallenge")
            attempt = apps.get_model("accounts", "EmailAttempt")
            self.assertEqual(list(user.objects.order_by("pk").values()), before)
            self.assertFalse(credential.objects.exists())
            self.assertFalse(challenge.objects.exists())
            self.assertFalse(attempt.objects.exists())

            now = timezone.now()
            credential.objects.create(
                user_id=first.pk, email="confirmed@example.com", username="confirmed", verified_at=now,
            )
            invalid_credentials = [
                {"email": "confirmed@example.com"},
                {"username": "confirmed"},
                {"user_id": first.pk},
                {"email": "UPPER@example.com"},
                {"email": ""},
                {"username": "UPPER"},
                {"username": ""},
                {"verified_at": None},
            ]
            for changes in invalid_credentials:
                with self.subTest(credential=changes), self.assertRaises(IntegrityError), transaction.atomic():
                    credential.objects.create(**{
                        "user_id": second.pk, "email": "other@example.com", "username": "other",
                        "verified_at": now, **changes,
                    })

            expires = now + timedelta(minutes=10)
            for number, (purpose, user_id) in enumerate((
                ("register", None), ("link", first.pk), ("reset", first.pk),
            ), start=1):
                challenge.objects.create(
                    purpose=purpose, user_id=user_id, email="confirmed@example.com",
                    selector=f"{number:064x}", expires_at=expires,
                )
            self.assertEqual(challenge.objects.filter(sent_at__isnull=True).count(), 3)
            challenge.objects.filter(selector=f"{1:064x}").update(sent_at=now)
            self.assertEqual(challenge.objects.filter(sent_at__isnull=True).count(), 2)
            for purpose, user_id in (
                ("register", first.pk), ("link", None), ("reset", None), ("unknown", first.pk),
            ):
                with self.subTest(purpose=purpose, user_id=user_id), self.assertRaises(IntegrityError), transaction.atomic():
                    challenge.objects.create(
                        purpose=purpose, user_id=user_id, email="confirmed@example.com",
                        selector="a" * 64, expires_at=expires,
                    )
            with self.assertRaises(IntegrityError), transaction.atomic():
                challenge.objects.create(
                    purpose="register", email="different@example.com", selector=f"{1:064x}",
                    expires_at=expires,
                )
            attempt.objects.create(key="b" * 64, window_started_at=now)
            with self.assertRaises(IntegrityError), transaction.atomic():
                attempt.objects.create(key="c" * 64, window_started_at=now, count=-1)
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
