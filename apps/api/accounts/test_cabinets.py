from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from catalog.models import Favorite, Service
from .models import User
from .test_workspace import approved_performer


class CabinetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(801001, display_name="Анна", is_customer=True, is_performer=True)
        self.other = User.objects.create_user(801002, display_name="Другой")
        approved_performer(self.other)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)
        self.service = Service.objects.create(performer=self.other, title="Услуга", description="Описание",
                                             price_amount="100.00", duration_days=1, status="published")

    def write(self, method, url, body=None):
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return getattr(self.client, method)(url, body or {}, format="json", HTTP_X_CSRFTOKEN=token)

    def test_one_identity_both_roles_private_projection_no_fabricated_metrics(self):
        account = self.client.get(reverse("account"))
        self.assertEqual(account.status_code, 200)
        self.assertEqual(account.json()["id"], self.user.pk)
        self.assertEqual(account.json()["registration"]["roles"], ["customer", "performer"])
        self.assertFalse(account.json()["capabilities"]["django_admin"])
        self.assertIn("no-store", account["Cache-Control"])
        for role in ("customer", "performer"):
            response = self.client.get(reverse("cabinet"), {"role": role})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["account_id"], self.user.pk)
            self.assertIsNone(response.json()["statistics"]["rating"])

    def test_roles_are_not_taken_from_query_or_staff_switch(self):
        self.user.is_performer = False
        self.user.save()
        self.assertEqual(self.client.get(reverse("cabinet"), {"role": "performer"}).status_code, 403)
        self.assertEqual(self.client.get(reverse("cabinet"), {"role": "admin"}).status_code, 400)
        self.client.logout()
        self.assertEqual(self.client.get(reverse("account")).status_code, 403)

    def test_favorites_idempotency_ownership_visibility_csrf_and_bad_input(self):
        detail = reverse("favorite-detail", args=[self.service.pk])
        self.assertEqual(self.client.put(detail, {}, format="json").status_code, 403)
        self.assertEqual(self.write("put", detail).status_code, 204)
        self.assertEqual(self.write("put", detail).status_code, 204)
        self.assertEqual(Favorite.objects.count(), 1)
        self.assertEqual(self.client.get(reverse("favorite-list")).json()["count"], 1)
        self.assertEqual(self.write("put", detail, {"user_id": self.other.pk}).status_code, 400)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse("favorite-list")).json()["count"], 0)
        self.assertEqual(self.write("delete", detail).status_code, 204)
        self.assertEqual(Favorite.objects.count(), 1)
        self.client.force_login(self.user)
        self.service.status = "pending"
        self.service.save()
        self.assertEqual(self.client.get(reverse("favorite-list")).json()["count"], 0)
        self.assertEqual(self.write("put", detail).status_code, 404)
        self.assertEqual(self.write("delete", detail).status_code, 204)
        self.assertEqual(self.write("delete", detail).status_code, 204)

    def test_roleless_account_cannot_create_service_or_order(self):
        roleless = User.objects.create_user(801004)
        self.client.force_login(roleless)
        self.assertEqual(self.write("post", reverse("catalog:own-list"), {
            "title": "x", "description": "x", "price_amount": "1.00", "duration_days": 1,
        }).status_code, 403)
        self.assertEqual(self.write("post", reverse("orders:list"), {}).status_code, 403)
