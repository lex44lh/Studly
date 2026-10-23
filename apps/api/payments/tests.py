"""Локальные проверки с подменой HTTP. Настоящих запросов к ЮKassa нет."""

from copy import deepcopy
from decimal import Decimal
from io import StringIO
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
import requests

from accounts.models import User
from catalog.models import Service
from orders.models import Order
from orders.services import accept_order, cancel_order, create_order
from payments.yookassa import TestCredentials, YooKassaError, YooKassaTestClient


PAYMENT_ID = "2855940e-000f-5000-9000-1ef78d597562"
DEAL_ID = "dl-285e5ee7-0022-5000-8000-01516a44b147"
SETTINGS = {"YOOKASSA_TEST_SHOP_ID": "100500", "YOOKASSA_TEST_SECRET_KEY": "local-fixture-not-a-key"}


def shop_data():
    return {"account_id": "100500", "test": True, "status": "enabled"}


def payment_data(order_id=37):
    return {
        "id": PAYMENT_ID, "test": True, "status": "succeeded", "paid": True,
        "amount": {"value": "1030.00", "currency": "RUB"},
        "recipient": {"account_id": "100500"},
        "metadata": {"order_id": str(order_id)}, "deal": {"id": DEAL_ID},
        "payment_method": {"card": {"last4": "0000"}},
    }


def http_response(data=None, status=200):
    response = Mock(status_code=status)
    response.json.return_value = data
    return response


@override_settings(**SETTINGS)
class YooKassaClientTests(SimpleTestCase):
    def setUp(self):
        self.get = self.enterContext(patch("payments.yookassa.requests.get"))
        self.client = YooKassaTestClient()

    def inspect(self, **overrides):
        values = {"payment_id": PAYMENT_ID, "deal_id": DEAL_ID, "order_id": 37, "amount": Decimal("1030.00")}
        values.update(overrides)
        return self.client.inspect_payment(**values)

    def respond_with(self, payment):
        self.get.side_effect = [http_response(shop_data()), http_response(payment)]

    def test_exact_test_payment_is_read_with_auth_timeout_and_no_redirects(self):
        self.respond_with(payment_data())
        result = self.inspect()
        self.assertEqual(result.status, "succeeded")
        self.assertEqual(result.amount, Decimal("1030.00"))
        self.assertEqual(result.payment_id, PAYMENT_ID)
        self.assertNotIn("card", repr(result))
        self.assertEqual(self.get.call_count, 2)
        for call, path in zip(self.get.call_args_list, ("/me", "/payments/" + PAYMENT_ID)):
            self.assertEqual(call.args, ("https://api.yookassa.ru/v3" + path,))
            self.assertEqual(call.kwargs, {
                "auth": ("100500", SETTINGS["YOOKASSA_TEST_SECRET_KEY"]),
                "headers": {"Accept": "application/json"}, "timeout": (5, 10), "allow_redirects": False,
            })

    def test_all_known_states_are_observed_without_treating_hold_as_capture(self):
        for status, paid in (("pending", False), ("waiting_for_capture", True), ("succeeded", True), ("canceled", False)):
            with self.subTest(status=status):
                data = payment_data()
                data.update(status=status, paid=paid)
                self.respond_with(data)
                result = self.inspect()
                self.assertEqual((result.status, result.paid), (status, paid))

    def test_wrong_or_non_test_shop_stops_before_payment_lookup(self):
        for changed in ({"account_id": "999"}, {"test": False}, {"test": "true"}, {"test": 1}):
            with self.subTest(changed=changed):
                self.get.reset_mock(side_effect=True)
                self.get.return_value = http_response(shop_data() | changed)
                with self.assertRaises(YooKassaError):
                    self.inspect()
                self.assertEqual(self.get.call_count, 1)

    def test_mismatched_payment_shop_order_and_deal_are_rejected(self):
        for field, value in (
            ("id", "2855940e-000f-5000-9000-1ef78d597563"),
            ("recipient", {"account_id": "999"}), ("recipient", None),
            ("metadata", {"order_id": "38"}), ("metadata", {"order_id": 37}), ("metadata", None),
            ("deal", {"id": DEAL_ID[:-1] + "8"}), ("deal", None),
        ):
            with self.subTest(field=field, value=value):
                data = payment_data()
                data[field] = value
                self.respond_with(data)
                with self.assertRaises(YooKassaError):
                    self.inspect()

    def test_test_flag_must_be_boolean_true(self):
        for flag in (False, None, "true", 1):
            with self.subTest(flag=flag):
                self.respond_with(payment_data() | {"test": flag})
                with self.assertRaises(YooKassaError):
                    self.inspect()

    def test_wrong_amount_currency_and_malformed_values_are_rejected(self):
        for value in ("1000.00", "1030.01", "1030.001", "1.03E+3", "NaN", "Infinity", "-1030.00", "01030.00", " 1030.00", 1030.0, None):
            with self.subTest(value=value):
                self.respond_with(payment_data() | {"amount": {"value": value, "currency": "RUB"}})
                with self.assertRaises(YooKassaError):
                    self.inspect()
        for value in (None, {}, {"value": "1030.00", "currency": "USD"}):
            with self.subTest(amount=value):
                self.respond_with(payment_data() | {"amount": value})
                with self.assertRaises(YooKassaError):
                    self.inspect()

    def test_unknown_or_inconsistent_states_are_rejected(self):
        for values in (
            {"status": "new-provider-state"}, {"status": []}, {"status": None},
            {"paid": "true"}, {"paid": 1}, {"paid": None}, {"paid": False},
            {"status": "waiting_for_capture", "paid": False},
        ):
            with self.subTest(values=values):
                self.respond_with(payment_data() | values)
                with self.assertRaises(YooKassaError):
                    self.inspect()

    def test_required_payment_fields_cannot_be_missing(self):
        for field in ("id", "test", "recipient", "metadata", "deal", "amount", "status", "paid"):
            with self.subTest(field=field):
                data = payment_data()
                del data[field]
                self.respond_with(data)
                with self.assertRaises(YooKassaError):
                    self.inspect()

    def test_invalid_local_identifiers_and_amounts_do_not_send_requests(self):
        for values in (
            {"payment_id": "../me"}, {"payment_id": "https://example.com"}, {"payment_id": None},
            {"deal_id": "bad"}, {"deal_id": None}, {"order_id": True}, {"order_id": 0},
            {"order_id": 2**63}, {"amount": 1030.0}, {"amount": Decimal("NaN")},
            {"amount": Decimal("0.00")}, {"amount": Decimal("1030.001")},
        ):
            with self.subTest(values=values):
                with self.assertRaises(YooKassaError):
                    self.inspect(**values)
        self.get.assert_not_called()

    def test_http_errors_and_redirects_are_not_success_or_secret_echoes(self):
        for status in (301, 302, 400, 401, 403, 404, 429, 500, 503):
            with self.subTest(status=status):
                response = http_response({"description": SETTINGS["YOOKASSA_TEST_SECRET_KEY"]}, status=status)
                self.get.side_effect = [http_response(shop_data()), response]
                with self.assertRaises(YooKassaError) as error:
                    self.inspect()
                self.assertNotIn(SETTINGS["YOOKASSA_TEST_SECRET_KEY"], str(error.exception))
                response.json.assert_not_called()
                response.close.assert_called_once()

    def test_network_failure_during_shop_or_payment_lookup_is_not_echoed(self):
        for error_type in (requests.Timeout, requests.ConnectionError, requests.exceptions.SSLError):
            for shop_succeeded in (False, True):
                with self.subTest(error_type=error_type, shop_succeeded=shop_succeeded):
                    error = error_type(SETTINGS["YOOKASSA_TEST_SECRET_KEY"])
                    self.get.side_effect = ([http_response(shop_data())] if shop_succeeded else []) + [error]
                    with self.assertRaises(YooKassaError) as caught:
                        self.inspect()
                    self.assertNotIn(SETTINGS["YOOKASSA_TEST_SECRET_KEY"], str(caught.exception))
                    self.assertTrue(caught.exception.__suppress_context__)

    def test_invalid_json_and_non_object_response_are_rejected(self):
        for data in (None, [], "unexpected"):
            with self.subTest(data=data):
                self.get.side_effect = [http_response(shop_data()), http_response(data)]
                with self.assertRaises(YooKassaError):
                    self.inspect()
        response = http_response()
        response.json.side_effect = ValueError(SETTINGS["YOOKASSA_TEST_SECRET_KEY"])
        self.get.side_effect = [http_response(shop_data()), response]
        with self.assertRaises(YooKassaError) as caught:
            self.inspect()
        self.assertNotIn(SETTINGS["YOOKASSA_TEST_SECRET_KEY"], str(caught.exception))
        response.close.assert_called_once()

    def test_configuration_errors_and_repr_do_not_reveal_secrets(self):
        self.assertNotIn(SETTINGS["YOOKASSA_TEST_SECRET_KEY"], repr(TestCredentials.from_settings()))
        for changes in (
            {"YOOKASSA_TEST_SHOP_ID": ""}, {"YOOKASSA_TEST_SECRET_KEY": ""},
            {"YOOKASSA_TEST_SHOP_ID": "-1"}, {"YOOKASSA_TEST_SHOP_ID": "invalid"},
            {"YOOKASSA_TEST_SECRET_KEY": "bad key"},
        ):
            with self.subTest(changes=changes), override_settings(**changes):
                with self.assertRaises(YooKassaError):
                    YooKassaTestClient()
        self.get.assert_not_called()

    def test_default_command_checks_settings_without_network_or_database(self):
        output = StringIO()
        call_command("check_yookassa_test", stdout=output)
        self.assertIn("ещё не проверены", output.getvalue())
        self.assertNotIn(SETTINGS["YOOKASSA_TEST_SECRET_KEY"], output.getvalue())
        self.get.assert_not_called()

    def test_command_connect_checks_shop_but_does_not_claim_safe_deal_access(self):
        self.get.return_value = http_response(shop_data())
        output = StringIO()
        call_command("check_yookassa_test", connect=True, stdout=output)
        self.assertIn("Безопасной сделки ещё не проверена", output.getvalue())
        self.assertEqual(self.get.call_count, 1)

    def test_incomplete_arguments_are_rejected_without_network_or_database(self):
        for options in ({"order_id": 37}, {"payment_id": PAYMENT_ID}, {"deal_id": DEAL_ID}):
            with self.subTest(options=options), self.assertRaisesMessage(CommandError, "Укажите вместе"):
                call_command("check_yookassa_test", **options, stdout=StringIO())
        self.get.assert_not_called()

    @override_settings(YOOKASSA_TEST_SHOP_ID="", YOOKASSA_TEST_SECRET_KEY="")
    def test_command_reports_missing_names_without_network_or_database(self):
        with self.assertRaisesMessage(CommandError, "YOOKASSA_TEST_SHOP_ID, YOOKASSA_TEST_SECRET_KEY"):
            call_command("check_yookassa_test", stdout=StringIO())
        self.get.assert_not_called()


@override_settings(**SETTINGS)
class YooKassaOrderDiagnosticTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.buyer = User.objects.create_user(telegram_id=63001, display_name="Заказчик", is_customer=True)
        cls.performer = User.objects.create_user(telegram_id=63002, display_name="Исполнитель")
        from accounts.test_workspace import approved_performer
        approved_performer(cls.performer)
        service = Service.objects.create(
            performer=cls.performer, title="Консультация", description="Разбор темы", included=["Консультация"],
            price_amount=Decimal("1000.00"), duration_days=2, status=Service.Status.PUBLISHED,
        )
        cls.order, _ = create_order(buyer=cls.buyer, data={
            "service_id": service.pk, "service_revision": service.revision,
            "request_key": "aaaaaaaa-0000-4000-8000-000000000001",
        })
        accept_order(user=cls.performer, pk=cls.order.pk)

    def setUp(self):
        self.get = self.enterContext(patch("payments.yookassa.requests.get"))
        self.options = {"order_id": self.order.pk, "payment_id": PAYMENT_ID, "deal_id": DEAL_ID}

    def test_successful_diagnostic_preserves_every_order_field_and_row_count(self):
        before = deepcopy(Order.objects.values().get(pk=self.order.pk))
        self.get.side_effect = [http_response(shop_data()), http_response(payment_data(self.order.pk))]
        output = StringIO()
        with self.assertNumQueries(1):
            call_command("check_yookassa_test", **self.options, stdout=output)
        self.assertIn("Статус ЮKassa: succeeded", output.getvalue())
        self.assertIn("Статус заказа STUDLY: awaiting_payment", output.getvalue())
        self.assertEqual(Order.objects.values().get(pk=self.order.pk), before)
        self.assertEqual(Order.objects.count(), 1)

    def test_hold_has_explanation_and_never_starts_work(self):
        data = payment_data(self.order.pk) | {"status": "waiting_for_capture"}
        self.get.side_effect = [http_response(shop_data()), http_response(data)]
        output = StringIO()
        call_command("check_yookassa_test", **self.options, stdout=output)
        self.assertIn("ожидают списания", output.getvalue())
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.AWAITING_PAYMENT)

    def test_late_success_does_not_reopen_cancelled_order(self):
        cancel_order(user=self.buyer, pk=self.order.pk)
        before = Order.objects.values().get(pk=self.order.pk)
        self.get.side_effect = [http_response(shop_data()), http_response(payment_data(self.order.pk))]
        output = StringIO()
        call_command("check_yookassa_test", **self.options, stdout=output)
        self.assertIn("Статус заказа STUDLY: cancelled", output.getvalue())
        self.assertEqual(Order.objects.values().get(pk=self.order.pk), before)

    def test_order_snapshot_is_used_even_after_service_price_changes(self):
        Service.objects.filter(pk=self.order.service_id).update(price_amount=Decimal("2000.00"))
        self.get.side_effect = [http_response(shop_data()), http_response(payment_data(self.order.pk))]
        call_command("check_yookassa_test", **self.options, stdout=StringIO())

    def test_failed_verification_does_not_change_order(self):
        before = Order.objects.values().get(pk=self.order.pk)
        data = payment_data(self.order.pk) | {"amount": {"value": "1000.00", "currency": "RUB"}}
        self.get.side_effect = [http_response(shop_data()), http_response(data)]
        with self.assertRaisesMessage(CommandError, "Сумма платежа не совпала"):
            call_command("check_yookassa_test", **self.options, stdout=StringIO())
        self.assertEqual(Order.objects.values().get(pk=self.order.pk), before)

    def test_missing_order_does_not_contact_provider(self):
        with self.assertRaisesMessage(CommandError, "Заказ STUDLY не найден"):
            call_command("check_yookassa_test", **(self.options | {"order_id": 2**63 - 1}), stdout=StringIO())
        self.get.assert_not_called()

    def test_invalid_order_id_is_rejected_before_database_lookup(self):
        for value in (0, -1, 2**63):
            with self.subTest(value=value), self.assertRaisesMessage(CommandError, "Некорректный идентификатор"):
                call_command("check_yookassa_test", **(self.options | {"order_id": value}), stdout=StringIO())
        self.get.assert_not_called()
