from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from .models import Service


class ServiceQuoteTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.performer = User.objects.create_user(
            123456789, display_name="Исполнитель", email="private@example.com"
        )
        cls.service = Service.objects.create(
            performer=cls.performer, title="Консультация", description="Описание",
            price_amount=Decimal("1000.00"), duration_days=2,
            status=Service.Status.PUBLISHED,
        )

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("catalog:quote", args=[self.service.pk])

    def test_public_quote_has_exact_amounts_and_only_quote_fields(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "service_id": self.service.pk,
            "service_revision": 1,
            "price_amount": "1000.00",
            "currency": "RUB",
            "is_demo": False,
            "buyer_fee_percent": "3.00",
            "buyer_fee_amount": "30.00",
            "total_amount": "1030.00",
        })
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("no-cache", response["Cache-Control"])

    def test_kopeck_rounding_zero_and_largest_catalog_price(self):
        cases = [
            ("0.00", "0.00", "0.00"),
            ("0.01", "0.00", "0.01"),
            ("0.16", "0.00", "0.16"),
            ("0.17", "0.01", "0.18"),
            ("0.50", "0.02", "0.52"),
            ("33.50", "1.01", "34.51"),
            ("99999999.99", "3000000.00", "102999999.99"),
        ]
        for price, fee, total in cases:
            with self.subTest(price=price):
                Service.objects.filter(pk=self.service.pk).update(price_amount=price)
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertEqual(data["price_amount"], price)
                self.assertEqual(data["buyer_fee_amount"], fee)
                self.assertEqual(data["total_amount"], total)

    def test_client_cannot_override_price_rate_currency_or_revision(self):
        data = self.client.get(self.url, {
            "price_amount": "1.00", "buyer_fee_percent": "0.00",
            "buyer_fee_amount": "0.00", "currency": "USD", "service_revision": "999",
        }).json()
        self.assertEqual(data["price_amount"], "1000.00")
        self.assertEqual(data["buyer_fee_percent"], "3.00")
        self.assertEqual(data["buyer_fee_amount"], "30.00")
        self.assertEqual(data["total_amount"], "1030.00")
        self.assertEqual(data["currency"], "RUB")
        self.assertEqual(data["service_revision"], 1)

    def test_pending_rejected_and_missing_services_have_no_public_quote(self):
        for status in (Service.Status.PENDING, Service.Status.REJECTED):
            with self.subTest(status=status):
                Service.objects.filter(pk=self.service.pk).update(status=status)
                self.assertEqual(self.client.get(self.url).status_code, 404)
        for pk in (0, 2**62, 2**63):
            with self.subTest(pk=pk):
                self.assertEqual(self.client.get(reverse("catalog:quote", args=[pk])).status_code, 404)

    def test_demo_quote_remains_explicitly_demo(self):
        Service.objects.filter(pk=self.service.pk).update(is_demo=True)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json()["is_demo"], True)

    def test_edit_hides_quote_until_republished_with_new_price_and_revision(self):
        self.client.force_login(self.performer)
        edited = self.client.patch(
            reverse("catalog:own-detail", args=[self.service.pk]),
            {"price_amount": "2000.00"}, format="json",
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        # Решения модератора отдельно покрыты test_moderation.py.
        Service.objects.filter(pk=self.service.pk).update(status=Service.Status.PUBLISHED)
        data = self.client.get(self.url).json()
        self.assertEqual(data["service_revision"], 2)
        self.assertEqual(data["price_amount"], "2000.00")
        self.assertEqual(data["buyer_fee_amount"], "60.00")
        self.assertEqual(data["total_amount"], "2060.00")

    def test_quote_request_leaves_catalog_and_accounts_unchanged(self):
        before_service = Service.objects.values().get(pk=self.service.pk)
        before_users = list(User.objects.order_by("pk").values())
        before_count = Service.objects.count()
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(Service.objects.values().get(pk=self.service.pk), before_service)
        self.assertEqual(list(User.objects.order_by("pk").values()), before_users)
        self.assertEqual(Service.objects.count(), before_count)

    def test_quote_does_not_accept_writes(self):
        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(
                    self.url, {"price_amount": "1.00"}, format="json"
                )
                self.assertEqual(response.status_code, 405)
        self.service.refresh_from_db()
        self.assertEqual(self.service.price_amount, Decimal("1000.00"))

    def test_unsupported_currency_is_not_silently_priced_in_rubles(self):
        Service.objects.filter(pk=self.service.pk).update(currency="USD")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"currency": "Расчёт доступен только для услуг в RUB."})
