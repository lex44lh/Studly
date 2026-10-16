from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from .models import Service


class ServiceEditingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(40001, display_name="Автор")
        cls.other = User.objects.create_user(40002)

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.service = Service.objects.create(
            performer=self.owner, title="Исходная услуга", description="Описание",
            price_amount="500.00", duration_days=3, included=["Консультация"],
            status=Service.Status.PUBLISHED,
        )
        self.url = reverse("catalog:own-detail", args=[self.service.pk])

    def edit(self, payload, url=None):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return self.client.patch(url or self.url, payload, format="json", HTTP_X_CSRFTOKEN=csrf)

    def test_edit_hides_published_service_and_preserves_unsupplied_fields(self):
        self.assertEqual(self.client.get(reverse("catalog:list")).json()["count"], 1)
        response = self.edit({"title": "Исправленная услуга", "price_amount": "650.00"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "pending")
        self.assertIn("no-store", response["Cache-Control"])
        self.service.refresh_from_db()
        self.assertEqual(self.service.title, "Исправленная услуга")
        self.assertEqual(str(self.service.price_amount), "650.00")
        self.assertEqual(self.service.description, "Описание")
        self.assertEqual(self.service.included, ["Консультация"])
        self.assertEqual(self.service.performer, self.owner)
        self.assertEqual(self.service.revision, 2)
        self.assertFalse(self.service.is_demo)
        self.assertEqual(self.client.get(reverse("catalog:list")).json()["count"], 0)
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[self.service.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("catalog:performer", args=[self.owner.pk])).status_code, 404)
        self.assertEqual(self.client.get(self.url).json(), response.json())

    def test_rejected_and_pending_services_can_be_corrected_and_resubmitted(self):
        for status in (Service.Status.REJECTED, Service.Status.PENDING):
            with self.subTest(status=status):
                Service.objects.filter(pk=self.service.pk).update(status=status)
                response = self.edit({"description": "Новое описание", "duration_days": 4,
                                      "included": [], "currency": "RUB"})
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()["status"], "pending")
                self.assertEqual(response.json()["description"], "Новое описание")
                self.assertEqual(response.json()["included"], [])
        self.service.refresh_from_db()
        self.assertEqual(self.service.revision, 3)

    def test_invalid_or_empty_patch_does_not_change_content_status_or_revision(self):
        for fields in ({}, {"title": " "}, {"description": ""}, {"price_amount": "-1"},
                       {"price_amount": "1.001"}, {"duration_days": 0}, {"duration_days": 32768},
                       {"included": [""]}, {"currency": "USD"}):
            with self.subTest(fields=fields):
                response = self.edit(fields)
                self.assertEqual(response.status_code, 400, response.content)
                self.service.refresh_from_db()
                self.assertEqual(self.service.title, "Исходная услуга")
                self.assertEqual(self.service.status, Service.Status.PUBLISHED)
                self.assertEqual(self.service.revision, 1)

    def test_cannot_assign_owner_status_demo_or_internal_revision(self):
        for fields in ({"performer": self.other.pk}, {"id": 123}, {"status": "published"},
                       {"is_demo": True}, {"demo_key": "python"}, {"revision": 20}):
            with self.subTest(fields=fields):
                response = self.edit({"title": "Не должно сохраниться", **fields})
                self.assertEqual(response.status_code, 400, response.content)
        self.service.refresh_from_db()
        self.assertEqual(self.service.title, "Исходная услуга")
        self.assertEqual(self.service.revision, 1)
        self.assertEqual(self.service.status, Service.Status.PUBLISHED)

    def test_foreign_or_missing_service_returns_404(self):
        self.client.force_login(self.other)
        for url in (self.url, reverse("catalog:own-detail", args=[2**62])):
            with self.subTest(url=url):
                self.assertEqual(self.edit({"title": "Чужое изменение"}, url).status_code, 404)
        self.service.refresh_from_db()
        self.assertEqual(self.service.revision, 1)

    def test_edit_requires_active_session_and_csrf(self):
        response = self.client.patch(self.url, {"title": "Без CSRF"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.client.logout()
        self.assertEqual(self.edit({"title": "Без входа"}).status_code, 403)
        self.owner.is_active = False
        self.owner.save(update_fields=["is_active"])
        self.client.force_login(self.owner)
        self.assertEqual(self.edit({"title": "Отключённый аккаунт"}).status_code, 403)
        self.service.refresh_from_db()
        self.assertEqual(self.service.revision, 1)

    def test_put_and_delete_remain_unavailable(self):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        for method in (self.client.put, self.client.delete):
            response = method(self.url, {}, format="json", HTTP_X_CSRFTOKEN=csrf)
            self.assertEqual(response.status_code, 405)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PUBLISHED)

    def test_browsable_api_can_read_and_patch_json_with_same_authentication(self):
        response = self.client.get(self.url, HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Исходная услуга")
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        response = self.client.patch(self.url, {"title": "Из браузера"}, format="json",
                                     HTTP_X_CSRFTOKEN=csrf, HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertContains(response, "Из браузера")
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PENDING)
        self.assertEqual(self.service.revision, 2)

    def test_service_writes_accept_json_and_do_not_offer_incompatible_multipart_form(self):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        response = self.client.patch(self.url, {"title": "Неверный формат"}, format="multipart",
                                     HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 415)
        response = self.client.post(reverse("catalog:own-list"), {
            "title": "Форма", "description": "Описание", "price_amount": "100.00", "duration_days": 1,
        }, format="multipart", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 415)
        html = self.client.get(reverse("catalog:own-list"), HTTP_ACCEPT="text/html")
        self.assertEqual(html.status_code, 200)
        self.assertNotContains(html, 'name="csrfmiddlewaretoken"')
        self.assertContains(html, 'name="_content"')
        self.assertEqual(Service.objects.count(), 1)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PUBLISHED)
