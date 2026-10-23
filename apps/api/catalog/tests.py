from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accounts.test_workspace import approved_performer
from .models import Service


class CatalogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.performer = User.objects.create_user(
            123456789, display_name="Исполнитель", about="Описание профиля",
            telegram_username="private_username", email="private@example.com",
        )
        cls.service = Service.objects.create(
            performer=cls.performer, title="Помощь с Python", description="Разбор алгоритмов",
            price_amount="900.00", duration_days=4, included=["Консультация"],
            status=Service.Status.PUBLISHED,
        )
        cls.other = Service.objects.create(
            performer=User.objects.create_user(987654321, display_name="Другой"),
            title="Английский язык", description="Грамматика", price_amount="700.00", duration_days=7,
            status=Service.Status.PUBLISHED,
        )
        approved_performer(cls.performer)
        approved_performer(cls.other.performer)

    def setUp(self):
        self.client = APIClient()

    def test_server_ranges_category_ordering_and_invalid_filters(self):
        Service.objects.filter(pk=self.service.pk).update(category="programming")
        response = self.client.get(reverse("catalog:list"), {"category": "programming", "min_price": "800.00", "max_price": "1000.00", "max_duration": "5"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([x["id"] for x in response.json()["results"]], [self.service.pk])
        response = self.client.get(reverse("catalog:list"), {"ordering": "price_desc"})
        self.assertEqual([x["id"] for x in response.json()["results"]], [self.service.pk, self.other.pk])
        for query in ({"min_price": "NaN"}, {"max_price": "Infinity"}, {"min_price": "1.001"}, {"min_price": "10", "max_price": "1"},
                      {"min_duration": "-1"}, {"ordering": "rating"}, {"min_rating": "4"}):
            self.assertEqual(self.client.get(reverse("catalog:list"), query).status_code, 400, query)

    def test_public_list_reads_database_and_has_stable_pagination(self):
        response = self.client.get(reverse("catalog:list"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual([item["id"] for item in data["results"]], [self.service.pk, self.other.pk])
        Service.objects.filter(pk=self.service.pk).update(price_amount="950.00")
        detail = self.client.get(reverse("catalog:detail", args=[self.service.pk])).json()
        self.assertEqual(detail["price_amount"], "950.00")
        self.assertEqual(detail["currency"], "RUB")
        self.assertEqual(detail["included"], ["Консультация"])
        self.assertEqual(detail["performer"], {"id": self.performer.pk, "name": "Исполнитель"})

    def test_search_in_title_and_description_and_empty_result(self):
        for query in ("python", "алгоритмов"):
            with self.subTest(query=query):
                data = self.client.get(reverse("catalog:list"), {"search": query}).json()
                self.assertEqual([item["id"] for item in data["results"]], [self.service.pk])
        self.assertEqual(self.client.get(reverse("catalog:list"), {"search": "несуществующее"}).json()["count"], 0)

    def test_filter_by_performer_and_favorite_ids(self):
        for params in ({"performer": self.performer.pk}, {"ids": str(self.service.pk)}):
            with self.subTest(params=params):
                data = self.client.get(reverse("catalog:list"), params).json()
                self.assertEqual([item["id"] for item in data["results"]], [self.service.pk])
        self.assertEqual(self.client.get(reverse("catalog:list"), {"ids": ""}).json()["count"], 0)

    def test_bad_filters_return_400_instead_of_server_error(self):
        for field in ("ids", "performer"):
            for value in ("abc", "-1", "0", "9" * 5000, str(2**63), "١"):
                with self.subTest(field=field, value=value[:30]):
                    self.assertEqual(self.client.get(reverse("catalog:list"), {field: value}).status_code, 400)
        self.assertEqual(self.client.get(reverse("catalog:list"), {"ids": ",".join(["1"] * 101)}).status_code, 400)

    def test_multiple_pages_do_not_skip_or_duplicate_services(self):
        Service.objects.bulk_create([
            Service(performer=self.performer, title=f"Услуга {index}", description="Описание",
                    price_amount="1.00", duration_days=1, status=Service.Status.PUBLISHED)
            for index in range(21)
        ])
        first = self.client.get(reverse("catalog:list")).json()
        second = self.client.get(reverse("catalog:list"), {"page": 2}).json()
        self.assertEqual(first["count"], 23)
        self.assertEqual(len(first["results"]), 20)
        self.assertEqual(len(second["results"]), 3)
        self.assertTrue(first["next"])
        self.assertIsNone(second["next"])
        self.assertEqual(len({item["id"] for item in first["results"] + second["results"]}), 23)

    def test_public_profile_contains_only_public_fields(self):
        data = self.client.get(reverse("catalog:performer", args=[self.performer.pk])).json()
        self.assertEqual(data, {"id": self.performer.pk, "name": "Исполнитель", "about": "Описание профиля"})
        private_user = User.objects.create_user(4567)
        self.assertEqual(self.client.get(reverse("catalog:performer", args=[private_user.pk])).status_code, 404)

    def test_missing_records_and_public_write_are_rejected(self):
        for name in ("catalog:detail", "catalog:performer"):
            self.assertEqual(self.client.get(reverse(name, args=[2**62])).status_code, 404)
        self.assertEqual(self.client.post(reverse("catalog:list"), {}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(reverse("catalog:detail", args=[self.service.pk]), {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(reverse("catalog:detail", args=[self.service.pk])).status_code, 405)

    def test_database_rejects_negative_price_and_zero_duration(self):
        for fields in ({"price_amount": "-1.00"}, {"duration_days": 0}):
            with self.subTest(fields=fields), self.assertRaises(IntegrityError), transaction.atomic():
                Service.objects.filter(pk=self.service.pk).update(**fields)


class DemoCatalogTests(TestCase):
    def test_seed_is_repeatable_preserves_edits_and_cannot_create_login_accounts(self):
        call_command("seed_demo_catalog", stdout=StringIO())
        self.assertEqual(Service.objects.count(), 4)
        self.assertEqual(User.objects.count(), 4)
        service = Service.objects.get(demo_key="python")
        service.price_amount = Decimal("999.00")
        service.save()
        call_command("seed_demo_catalog", stdout=StringIO())
        service.refresh_from_db()
        self.assertEqual(service.price_amount, Decimal("999.00"))
        self.assertEqual(Service.objects.count(), 4)
        self.assertEqual(User.objects.count(), 4)
        self.assertTrue(all(item.is_demo for item in Service.objects.all()))
        self.assertTrue(all(item.status == Service.Status.PUBLISHED for item in Service.objects.all()))
        for user in User.objects.all():
            self.assertIsNone(user.telegram_id)
            self.assertFalse(user.is_active)
            self.assertFalse(user.has_usable_password())
        with self.assertRaises(ValueError):
            User.objects.create_user(None)


class AuthOptionsTests(TestCase):
    @override_settings(TELEGRAM_BOT_TOKEN="", TELEGRAM_OIDC_CLIENT_ID="", TELEGRAM_OIDC_CLIENT_SECRET="")
    def test_options_are_public_and_contain_no_secrets(self):
        response = self.client.get(reverse("accounts:options"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"telegram_mini_app": False, "telegram_website": False})

    @override_settings(TELEGRAM_BOT_TOKEN="fake-local-test-token", TELEGRAM_OIDC_CLIENT_ID="123",
                       TELEGRAM_OIDC_CLIENT_SECRET="fake-secret", TELEGRAM_OIDC_REDIRECT_URI="https://example.com/callback")
    def test_configured_methods_are_available_without_exposing_credentials(self):
        self.assertEqual(self.client.get(reverse("accounts:options")).json(),
                         {"telegram_mini_app": True, "telegram_website": True})
