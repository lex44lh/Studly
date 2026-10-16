"""Диагностика без создания платежей и без изменения данных заказа."""

from django.core.management.base import BaseCommand, CommandError

from orders.models import Order
from payments.yookassa import TestCredentials, YooKassaError, YooKassaTestClient


class Command(BaseCommand):
    help = "Проверить настройки тестовой ЮKassa или сверить существующий тестовый платёж без изменения БД."
    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument("--connect", action="store_true", help="Получить настройки магазина из ЮKassa.")
        parser.add_argument("--order-id", type=int)
        parser.add_argument("--payment-id")
        parser.add_argument("--deal-id")

    def handle(self, *args, **options):
        identifiers = [options["order_id"], options["payment_id"], options["deal_id"]]
        supplied = [value is not None for value in identifiers]
        if any(supplied) and not all(supplied):
            raise CommandError("Укажите вместе --order-id, --payment-id и --deal-id.")
        try:
            TestCredentials.from_settings()
            if not any(supplied):
                if options["connect"]:
                    YooKassaTestClient().check_shop()
                    self.stdout.write(self.style.SUCCESS(
                        "Доступ к тестовому магазину подтверждён. Доступность Безопасной сделки ещё не проверена."
                    ))
                else:
                    self.stdout.write(
                        "Настройки заданы. Доступ к ЮKassa и тестовый режим ещё не проверены; используйте --connect."
                    )
                return

            order_id = options["order_id"]
            if not 0 < order_id <= 2**63 - 1:
                raise CommandError("Некорректный идентификатор заказа STUDLY.")
            try:
                order = Order.objects.get(pk=order_id)
            except Order.DoesNotExist:
                raise CommandError("Заказ STUDLY не найден.") from None
            if order.currency != "RUB":
                raise CommandError("Сверка доступна только для заказа в RUB.")
            observation = YooKassaTestClient().inspect_payment(
                payment_id=options["payment_id"], deal_id=options["deal_id"],
                order_id=order.pk, amount=order.total_amount,
            )
        except YooKassaError as exc:
            raise CommandError(str(exc)) from None

        self.stdout.write(self.style.SUCCESS(
            f"Тестовый платёж сверен. Статус ЮKassa: {observation.status}. "
            f"Статус заказа STUDLY: {order.status}. Данные заказа не изменены."
        ))
        if observation.status == "waiting_for_capture":
            self.stdout.write("Деньги авторизованы и ожидают списания; завершённое списание не подтверждено.")
        self.stdout.write("Диагностика не зачисляет деньги и не разрешает выполнение заказа автоматически.")
