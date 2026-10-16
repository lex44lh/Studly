from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class ModerationMigrationTests(TransactionTestCase):
    old_target = [("accounts", "0002_user_about_alter_user_telegram_id"), ("catalog", "0001_initial")]
    new_target = [("accounts", "0002_user_about_alter_user_telegram_id"),
                  ("catalog", "0003_service_revision")]

    def test_existing_demo_stays_visible_but_real_service_requires_moderation(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.old_target)
        try:
            old_apps = executor.loader.project_state(self.old_target).apps
            user = old_apps.get_model("accounts", "User").objects.create(telegram_id=30001)
            old_service = old_apps.get_model("catalog", "Service")
            demo = old_service.objects.create(performer_id=user.pk, title="Демо", description="Описание",
                                              price_amount="123.45", duration_days=2, is_demo=True)
            real = old_service.objects.create(performer_id=user.pk, title="Реальная", description="Описание",
                                              price_amount="987.65", duration_days=3)
            executor = MigrationExecutor(connection)
            executor.migrate(self.new_target)
            service = executor.loader.project_state(self.new_target).apps.get_model("catalog", "Service")
            migrated_demo = service.objects.get(pk=demo.pk)
            migrated_real = service.objects.get(pk=real.pk)
            self.assertEqual(migrated_demo.status, "published")
            self.assertEqual(migrated_real.status, "pending")
            self.assertEqual(str(migrated_demo.price_amount), "123.45")
            self.assertEqual(str(migrated_real.price_amount), "987.65")
            self.assertEqual(migrated_real.performer_id, user.pk)
            self.assertEqual(migrated_demo.revision, 1)
            self.assertEqual(migrated_real.revision, 1)
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
