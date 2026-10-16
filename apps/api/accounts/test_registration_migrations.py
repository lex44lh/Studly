from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class RegistrationMigrationTests(TransactionTestCase):
    old_target = [("accounts", "0002_user_about_alter_user_telegram_id")]

    def test_existing_real_and_demo_users_keep_identity_and_profile_without_invented_roles(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.old_target)
        try:
            old_user = executor.loader.project_state(self.old_target).apps.get_model("accounts", "User")
            real = old_user.objects.create(telegram_id=74001, display_name="Реальный", about="Описание")
            demo = old_user.objects.create(telegram_id=None, display_name="Демо", is_active=False)
            before = list(old_user.objects.filter(pk__in=[real.pk, demo.pk]).order_by("pk").values())
            executor = MigrationExecutor(connection)
            target = executor.loader.graph.leaf_nodes()
            executor.migrate(target)
            apps = executor.loader.project_state(target).apps
            user = apps.get_model("accounts", "User")
            for previous in before:
                after = user.objects.values().get(pk=previous["id"])
                self.assertEqual({field: after[field] for field in previous}, previous)
                self.assertFalse(after["is_customer"])
                self.assertFalse(after["is_performer"])
                self.assertFalse(after["display_name_customized"])
                self.assertEqual(after["avatar"], "")
            for model in ("RegistrationProgress", "PerformerProfile", "Specialization"):
                self.assertFalse(apps.get_model("accounts", model).objects.exists())
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
