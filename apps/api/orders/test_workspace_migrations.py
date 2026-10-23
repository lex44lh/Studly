from decimal import Decimal
from uuid import uuid4

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class WorkspaceMigrationTests(TransactionTestCase):
    def test_existing_three_percent_agreement_keeps_money_and_gets_one_context(self):
        executor = MigrationExecutor(connection)
        leaves = executor.loader.graph.leaf_nodes()
        old_targets = [("accounts", "0003_specialization_user_avatar_user_city_and_more"),
                       ("catalog", "0003_service_revision"), ("orders", "0002_order_cancellation")]
        try:
            executor.migrate(old_targets)
            old = executor.loader.project_state(old_targets).apps
            User = old.get_model("accounts", "User")
            Service = old.get_model("catalog", "Service")
            Order = old.get_model("orders", "Order")
            buyer = User.objects.create(telegram_id=861001, display_name="Заказчик", is_customer=True)
            owner = User.objects.create(telegram_id=861002, display_name="Исполнитель", is_performer=True)
            service = Service.objects.create(performer=owner, title="Старая услуга", description="Старое условие", price_amount=1000, duration_days=2)
            order = Order.objects.create(buyer=buyer, performer=owner, service=service, service_revision=1,
                request_key=uuid4(), title="Старый заказ", description="Старое условие", included=["Консультация"],
                duration_days=2, price_amount=1000, currency="RUB", buyer_fee_percent=3, buyer_fee_amount=30, total_amount=1030)
            pk = order.pk
            executor = MigrationExecutor(connection)
            executor.migrate(leaves)
            current = executor.loader.project_state(leaves).apps
            order = current.get_model("orders", "Order").objects.get(pk=pk)
            self.assertEqual((order.price_amount, order.buyer_fee_percent, order.total_amount),
                             (Decimal("1000.00"), Decimal("3.00"), Decimal("1030.00")))
            self.assertEqual(order.tariff_code, "buyer-3-v1")
            self.assertIsNone(order.quote_id)
            self.assertEqual(order.included, ["Консультация"])
            self.assertEqual(current.get_model("conversations", "Conversation").objects.filter(order_id=pk).count(), 1)
        finally:
            MigrationExecutor(connection).migrate(leaves)
