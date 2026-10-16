"""Только чтение тестовых платежей. Заказы и деньги этот модуль не изменяет."""

from dataclasses import dataclass, field
from decimal import Decimal
import re

from django.conf import settings
import requests


API_URL = "https://api.yookassa.ru/v3"
TIMEOUT = (5, 10)
UUID_PATTERN = r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"
MONEY_PATTERN = r"(?:0|[1-9][0-9]{0,8})\.[0-9]{2}"
STATUSES = {"pending", "waiting_for_capture", "succeeded", "canceled"}


class YooKassaError(Exception):
    """Сообщения безопасны для вывода; исходный ответ провайдера не включается."""


@dataclass(frozen=True)
class TestCredentials:
    shop_id: str
    secret_key: str = field(repr=False)

    @classmethod
    def from_settings(cls):
        shop_id = settings.YOOKASSA_TEST_SHOP_ID
        secret_key = settings.YOOKASSA_TEST_SECRET_KEY
        missing = [name for name, value in (
            ("YOOKASSA_TEST_SHOP_ID", shop_id),
            ("YOOKASSA_TEST_SECRET_KEY", secret_key),
        ) if not value]
        if missing:
            raise YooKassaError("Не заданы настройки: " + ", ".join(missing) + ".")
        if not isinstance(shop_id, str) or not re.fullmatch(r"[1-9][0-9]{0,19}", shop_id):
            raise YooKassaError("YOOKASSA_TEST_SHOP_ID должен содержать положительный числовой идентификатор.")
        if not isinstance(secret_key, str) or any(char.isspace() for char in secret_key):
            raise YooKassaError("Проверьте формат YOOKASSA_TEST_SECRET_KEY.")
        return cls(shop_id=shop_id, secret_key=secret_key)


@dataclass(frozen=True)
class PaymentObservation:
    payment_id: str
    deal_id: str
    status: str
    paid: bool
    amount: Decimal


class YooKassaTestClient:
    def __init__(self):
        self._credentials = TestCredentials.from_settings()

    def _get(self, path):
        try:
            response = requests.get(
                API_URL + path,
                auth=(self._credentials.shop_id, self._credentials.secret_key),
                headers={"Accept": "application/json"},
                timeout=TIMEOUT,
                allow_redirects=False,
            )
        except requests.RequestException:
            raise YooKassaError("ЮKassa недоступна. Состояние платежа не подтверждено; повторите проверку позже.") from None
        try:
            if response.status_code in (401, 403):
                raise YooKassaError("ЮKassa отклонила доступ. Проверьте настройки и права тестовой площадки.")
            if response.status_code == 404:
                raise YooKassaError("Объект не найден в ЮKassa для указанных настроек.")
            if response.status_code == 429 or response.status_code >= 500:
                raise YooKassaError("ЮKassa временно не выполнила запрос. Повторите проверку позже.")
            if response.status_code != 200:
                raise YooKassaError("ЮKassa вернула неожиданный HTTP-ответ. Сверка не выполнена.")
            try:
                data = response.json()
            except ValueError:
                raise YooKassaError("ЮKassa вернула некорректный JSON. Сверка не выполнена.") from None
            if not isinstance(data, dict):
                raise YooKassaError("ЮKassa вернула некорректный объект. Сверка не выполнена.")
            return data
        finally:
            response.close()

    def check_shop(self):
        data = self._get("/me")
        if data.get("account_id") != self._credentials.shop_id:
            raise YooKassaError("Идентификатор магазина ЮKassa не совпал с настройками.")
        if data.get("test") is not True:
            raise YooKassaError("Магазин ЮKassa не подтвердил тестовый режим. Проверка остановлена.")
        # /me не подтверждает доступность именно Безопасной сделки.

    def inspect_payment(self, *, payment_id, deal_id, order_id, amount):
        if not isinstance(payment_id, str) or not re.fullmatch(UUID_PATTERN, payment_id):
            raise YooKassaError("Некорректный идентификатор платежа ЮKassa.")
        if not isinstance(deal_id, str) or not re.fullmatch("dl-" + UUID_PATTERN, deal_id):
            raise YooKassaError("Некорректный идентификатор сделки ЮKassa.")
        if type(order_id) is not int or not 0 < order_id <= 2**63 - 1:
            raise YooKassaError("Некорректный идентификатор заказа STUDLY.")
        if not isinstance(amount, Decimal) or not re.fullmatch(MONEY_PATTERN, str(amount)) or amount <= 0:
            raise YooKassaError("Ожидаемая сумма должна быть положительной суммой RUB с точностью до копеек.")

        self.check_shop()
        data = self._get("/payments/" + payment_id)
        if data.get("test") is not True:
            raise YooKassaError("Платёж ЮKassa не подтвердил тестовый режим.")
        if data.get("id") != payment_id:
            raise YooKassaError("Идентификатор платежа ЮKassa не совпал с ожидаемым.")
        recipient = data.get("recipient")
        if not isinstance(recipient, dict) or recipient.get("account_id") != self._credentials.shop_id:
            raise YooKassaError("Получатель платежа не совпал с тестовым магазином.")
        metadata = data.get("metadata")
        if not isinstance(metadata, dict) or metadata.get("order_id") != str(order_id):
            raise YooKassaError("Платёж не соответствует идентификатору заказа STUDLY.")
        deal = data.get("deal")
        if not isinstance(deal, dict) or deal.get("id") != deal_id:
            raise YooKassaError("Платёж не соответствует ожидаемой Безопасной сделке.")
        payment_amount = data.get("amount")
        if not isinstance(payment_amount, dict) or payment_amount.get("currency") != "RUB":
            raise YooKassaError("Валюта платежа ЮKassa должна быть RUB.")
        value = payment_amount.get("value")
        if not isinstance(value, str) or not re.fullmatch(MONEY_PATTERN, value):
            raise YooKassaError("ЮKassa вернула некорректную денежную сумму.")
        if Decimal(value) != amount:
            raise YooKassaError("Сумма платежа не совпала с сохранённой суммой заказа.")
        status, paid = data.get("status"), data.get("paid")
        if not isinstance(status, str) or status not in STATUSES or type(paid) is not bool:
            raise YooKassaError("ЮKassa вернула неизвестное состояние платежа.")
        if status in ("succeeded", "waiting_for_capture") and not paid:
            raise YooKassaError("Состояние платежа ЮKassa противоречиво. Сверка не выполнена.")
        return PaymentObservation(payment_id=payment_id, deal_id=deal_id, status=status, paid=paid, amount=amount)
