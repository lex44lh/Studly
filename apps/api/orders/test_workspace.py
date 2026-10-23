from decimal import Decimal
from uuid import uuid4

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accounts.test_workspace import approved_performer
from catalog.models import Service
from conversations.models import Conversation
from .models import Order, Tariff


class QuoteOrderTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(821001, is_customer=True, display_name="Заказчик")
        self.owner = User.objects.create_user(821002, is_performer=True, display_name="Исполнитель")
        approved_performer(self.owner)
        self.extra = {"id": str(uuid4()), "title": "Отчёт", "price_amount": "300.00", "extra_days": 1}
        self.service = Service.objects.create(performer=self.owner, title="Python", description="Разбор", included=["Разбор"],
                     price_amount="1000.00", duration_days=3, status="published", extras=[self.extra])
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.buyer)

    def write(self, method, url, data):
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return getattr(self.client, method)(url, data, format="json", HTTP_X_CSRFTOKEN=token)

    def quote(self, **changes):
        response = self.write("post", reverse("quotes-v2"), {"service_id": self.service.pk, "extra_ids": [self.extra["id"]], **changes})
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def create(self, quote, key=None):
        return self.write("post", reverse("orders-v2"), {"quote_id": quote["quote_id"], "request_key": key or str(uuid4())})

    def test_five_percent_full_base_half_up_snapshot_and_context(self):
        quote = self.quote()
        self.assertEqual((quote["price_amount"], quote["buyer_fee_amount"], quote["total_amount"]), ("1300.00", "65.00", "1365.00"))
        self.assertEqual(quote["duration_days"], 4)
        response = self.create(quote)
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["tariff_code"], "buyer-5-v1")
        self.assertEqual(body["base_price_amount"], "1000.00")
        self.assertEqual(body["status"], "pending_acceptance")
        self.assertEqual(body["payment_status"], "unpaid")
        self.assertEqual(Conversation.objects.filter(order_id=body["id"]).count(), 1)
        self.service.price_amount = Decimal("1000.10")
        self.service.revision += 1
        self.service.save()
        quote = self.quote()
        self.assertEqual(quote["buyer_fee_amount"], "65.01")
        self.assertEqual(quote["total_amount"], "1365.11")
        self.assertEqual(Order.objects.get(pk=body["id"]).total_amount, Decimal("1365.00"))

    def test_historical_v1_stays_three_percent_and_key_cannot_cross_contracts(self):
        key = str(uuid4())
        response = self.write("post", reverse("orders:list"), {"service_id": self.service.pk, "service_revision": 1, "request_key": key})
        self.assertEqual(response.status_code, 201, response.content)
        order_id = response.json()["id"]
        self.assertEqual(response.json()["total_amount"], "1030.00")
        quote = self.quote()
        self.assertEqual(self.create(quote, key).status_code, 409)
        self.assertEqual(Order.objects.get(pk=order_id).buyer_fee_percent, Decimal("3.00"))

    def test_change_of_service_extra_or_tariff_requires_new_consent(self):
        for kind in ("service", "extra", "tariff"):
            with self.subTest(kind=kind):
                quote = self.quote()
                if kind == "service":
                    self.service.revision += 1
                    self.service.save()
                elif kind == "extra":
                    self.service.extras = [{**self.extra, "price_amount": "400.00"}]
                    self.service.save()
                else:
                    Tariff.objects.create(code="buyer-next", buyer_fee_percent="6.00")
                with override_settings(STUDLY_V2_BUYER_TARIFF="buyer-next" if kind == "tariff" else "buyer-5-v1"):
                    self.assertEqual(self.create(quote).status_code, 409)
        self.assertEqual(Order.objects.count(), 0)

    def test_repeat_returns_original_snapshot_even_after_tariff_and_service_change(self):
        quote = self.quote()
        key = str(uuid4())
        first = self.create(quote, key)
        self.assertEqual(first.status_code, 201, first.content)
        self.service.status = "rejected"
        self.service.save()
        with override_settings(STUDLY_V2_BUYER_TARIFF="does-not-exist"):
            repeated = self.create(quote, key)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.json(), first.json())
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_foreign_quotes_csrf_invalid_extras_and_client_money(self):
        quote = self.quote()
        self.assertEqual(self.client.post(reverse("orders-v2"), {}, format="json").status_code, 403)
        for changes in ({"extra_ids": [self.extra["id"], self.extra["id"]]}, {"extra_ids": [str(uuid4())]}, {"total_amount": "1.00"}):
            response = self.write("post", reverse("quotes-v2"), {"service_id": self.service.pk, **changes})
            self.assertEqual(response.status_code, 400)
        other = User.objects.create_user(821003, is_customer=True)
        self.client.force_login(other)
        self.assertEqual(self.create(quote).status_code, 404)
        self.assertEqual(self.client.get(reverse("quote-v2", args=[quote["quote_id"]])).status_code, 404)

    def test_missing_tariff_is_unavailable_and_money_boundaries_are_exact(self):
        with override_settings(STUDLY_V2_BUYER_TARIFF="missing"):
            self.assertEqual(self.write("post", reverse("quotes-v2"), {"service_id": self.service.pk}).status_code, 503)
        for price, fee, total in (("0.01", "0.00", "0.01"), ("0.10", "0.01", "0.11"), ("99999999.99", "5000000.00", "104999999.99")):
            self.service.price_amount = Decimal(price)
            self.service.save()
            quote = self.quote(extra_ids=[])
            self.assertEqual((quote["buyer_fee_amount"], quote["total_amount"]), (fee, total))
        self.assertEqual(self.write("post", reverse("quotes-v2"), {"service_id": self.service.pk, "extra_ids": [self.extra["id"]]}).status_code, 400)

    def test_versioned_action_filters_and_event_history(self):
        response = self.create(self.quote())
        body = response.json()
        self.client.force_login(self.owner)
        data = {"revision": body["revision"], "request_key": str(uuid4())}
        url = reverse("order-action-v2", args=[body["id"], "accept"])
        accepted = self.write("post", url, data)
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertEqual(accepted.json()["status"], "awaiting_payment")
        self.assertEqual(self.write("post", url, data).json(), accepted.json())
        self.assertEqual(self.write("post", url, {**data, "request_key": str(uuid4())}).status_code, 409)
        events = self.client.get(reverse("order-events", args=[body["id"]])).json()
        self.assertEqual([x["action"] for x in events["results"]], ["created", "accepted"])
        self.assertEqual(self.client.get(reverse("orders-v2"), {"role": "customer"}).json()["count"], 0)
        self.assertEqual(self.client.get(reverse("orders-v2"), {"role": "performer"}).json()["count"], 1)
