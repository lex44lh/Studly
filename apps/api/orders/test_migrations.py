from uuid import uuid4

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class OrderClosureMigrationTests(TransactionTestCase):
    old_target = [
        ("accounts", "0002_user_about_alter_user_telegram_id"),
        ("catalog", "0003_service_revision"), ("orders", "0001_initial"),
    ]
    new_target = [
        ("accounts", "0002_user_about_alter_user_telegram_id"),
        ("catalog", "0003_service_revision"), ("orders", "0002_order_cancellation"),
    ]

    def test_existing_pending_and_accepted_orders_preserve_conditions_and_history(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.old_target)
        try:
            apps = executor.loader.project_state(self.old_target).apps
            user_model = apps.get_model("accounts", "User")
            buyer = user_model.objects.create(telegram_id=64001)
            performer = user_model.objects.create(telegram_id=64002)
            service = apps.get_model("catalog", "Service").objects.create(
                performer_id=performer.pk, title="Услуга", description="Описание",
                price_amount="1000.00", duration_days=3, status="published",
            )
            old_order = apps.get_model("orders", "Order")
            for status, accepted_at in (("pending_acceptance", None), ("awaiting_payment", timezone.now())):
                old_order.objects.create(
                    buyer_id=buyer.pk, performer_id=performer.pk, service_id=service.pk,
                    service_revision=1, request_key=uuid4(), title="Сохранённая услуга",
                    description="Сохранённое описание", included=["Консультация"], duration_days=2,
                    price_amount="1000.00", currency="RUB", buyer_fee_percent="3.00",
                    buyer_fee_amount="30.00", total_amount="1030.00", status=status, accepted_at=accepted_at,
                )
            previous = list(old_order.objects.order_by("pk").values())
            executor = MigrationExecutor(connection)
            executor.migrate(self.new_target)
            order = executor.loader.project_state(self.new_target).apps.get_model("orders", "Order")
            self.assertEqual(order.objects.count(), 2)
            for before in previous:
                after = order.objects.values().get(pk=before["id"])
                self.assertEqual({field: after[field] for field in before}, before)
                self.assertIsNone(after["closed_at"])
                self.assertIsNone(after["closed_by_id"])
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
