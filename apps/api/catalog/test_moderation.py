import time
from unittest.mock import patch

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission
from django.core import signing
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accounts.test_workspace import approved_performer
from .models import Service


class ServiceSubmissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(10001, display_name="Автор", is_performer=True)
        cls.other = User.objects.create_user(10002, display_name="Другой", is_performer=True)

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.payload = {
            "title": "Консультация по Python", "description": "Объясню основы языка",
            "price_amount": "900.00", "duration_days": 4, "included": ["Разбор вопросов"],
        }

    def submit(self, **changes):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return self.client.post(reverse("catalog:own-list"), {**self.payload, **changes},
                                format="json", HTTP_X_CSRFTOKEN=csrf)

    def test_created_service_is_owned_pending_persistent_and_invisible_publicly(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        service = Service.objects.get(pk=data["id"])
        self.assertEqual(service.performer, self.owner)
        self.assertEqual(service.status, Service.Status.PENDING)
        self.assertEqual(service.price_amount, 900)
        self.assertEqual(data["status"], "pending")
        self.assertFalse(data["is_demo"])
        self.assertEqual(self.client.get(reverse("catalog:list")).json()["count"], 0)
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[service.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("catalog:performer", args=[self.owner.pk])).status_code, 404)
        own = self.client.get(reverse("catalog:own-detail", args=[service.pk]))
        self.assertEqual(own.json(), data)
        self.assertIn("no-store", own["Cache-Control"])

    def test_anonymous_and_inactive_users_cannot_submit_or_read_private_list(self):
        self.client.logout()
        self.assertEqual(self.submit().status_code, 403)
        self.assertEqual(self.client.get(reverse("catalog:own-list")).status_code, 403)
        self.owner.is_active = False
        self.owner.save(update_fields=["is_active"])
        self.client.force_login(self.owner)
        self.assertEqual(self.submit().status_code, 403)
        self.assertFalse(Service.objects.exists())

    def test_authenticated_submission_requires_csrf(self):
        response = self.client.post(reverse("catalog:own-list"), self.payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Service.objects.exists())

    def test_owner_status_demo_and_unknown_fields_cannot_be_supplied(self):
        for fields in ({"performer": self.other.pk}, {"status": "published"},
                       {"is_demo": True}, {"id": 99}, {"demo_key": "forged"}, {"unexpected": True}):
            with self.subTest(fields=fields):
                response = self.submit(**fields)
                self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Service.objects.exists())

    def test_invalid_fields_do_not_leave_records(self):
        for fields in ({"title": " "}, {"description": ""}, {"price_amount": "-1.00"},
                       {"price_amount": "1.001"}, {"duration_days": 0}, {"duration_days": 32768},
                       {"currency": "USD"}, {"included": "not-a-list"}, {"included": [""]},
                       {"included": ["a"] * 51}):
            with self.subTest(fields=fields):
                response = self.submit(**fields)
                self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Service.objects.exists())

    def test_private_list_and_detail_are_scoped_to_owner_for_every_status(self):
        own_ids = []
        for status in Service.Status.values:
            own_ids.append(Service.objects.create(
                performer=self.owner, title="Моя услуга", description="Описание",
                price_amount="10.00", duration_days=1, status=status,
            ).pk)
        foreign = Service.objects.create(performer=self.other, title="Чужая", description="Описание",
                                         price_amount="10.00", duration_days=1)
        response = self.client.get(reverse("catalog:own-list"))
        self.assertEqual([row["id"] for row in response.json()["results"]], own_ids)
        self.assertEqual(self.client.get(reverse("catalog:own-detail", args=[foreign.pk])).status_code, 404)
        self.assertEqual(self.client.patch(reverse("catalog:own-detail", args=[own_ids[0]]),
                                          {"status": "published"}, format="json").status_code, 403)
        # PUT и удаление не добавляются; PATCH проверяется отдельно.
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        self.assertEqual(self.client.put(reverse("catalog:own-detail", args=[own_ids[0]]),
                                          {}, format="json", HTTP_X_CSRFTOKEN=csrf).status_code, 405)

    def test_database_rejects_unknown_status(self):
        service = Service.objects.create(performer=self.owner, title="Услуга", description="Описание",
                                         price_amount="10.00", duration_days=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Service.objects.filter(pk=service.pk).update(status="unknown")


class ModerationAdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(20001, is_performer=True)
        approved_performer(cls.owner)
        cls.moderator = User.objects.create_user(20002, is_staff=True)
        cls.moderator.user_permissions.add(Permission.objects.get(codename="moderate_service"))
        cls.staff = User.objects.create_user(20003, is_staff=True)
        cls.staff.user_permissions.add(Permission.objects.get(codename="view_service"))

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.moderator)
        self.service = Service.objects.create(performer=self.owner, title="Заявка", description="Описание",
                                               price_amount="100.00", duration_days=2, category="programming", included=["Разбор"])
        self.service.portfolio_examples.set(self.owner.performer_profile.examples.all())

    def moderate(self, action, ids=None):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        fields = {
            "action": action, "_selected_action": ids or [self.service.pk],
        }
        url = reverse("admin:catalog_service_changelist")
        response = self.client.post(url, fields, HTTP_X_CSRFTOKEN=csrf)
        if response.status_code == 200 and response.context_data.get("review_token"):
            fields.update(confirm_moderation="yes", review_token=response.context_data["review_token"])
            return self.client.post(url, fields, HTTP_X_CSRFTOKEN=csrf)
        return response

    def test_approval_publishes_service_and_profile_and_creates_audit_log(self):
        self.assertEqual(self.client.get(reverse("admin:catalog_service_changelist")).status_code, 200)
        self.assertEqual(self.moderate("publish_services").status_code, 302)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PUBLISHED)
        self.assertEqual(self.client.get(reverse("catalog:list")).json()["count"], 1)
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[self.service.pk])).status_code, 200)
        self.assertEqual(self.client.get(reverse("catalog:performer", args=[self.owner.pk])).status_code, 200)
        log = LogEntry.objects.get()
        self.assertEqual(log.user, self.moderator)
        self.assertEqual(log.object_id, str(self.service.pk))
        self.assertIn("Опубликована", log.change_message)

    def test_rejection_is_visible_to_owner_but_not_public(self):
        self.assertEqual(self.moderate("reject_services").status_code, 302)
        self.client.force_login(self.owner)
        own = self.client.get(reverse("catalog:own-detail", args=[self.service.pk]))
        self.assertEqual(own.json()["status"], "rejected")
        self.assertEqual(self.client.get(reverse("catalog:list"), {"ids": self.service.pk}).json()["count"], 0)
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[self.service.pk])).status_code, 404)

    def test_staff_without_moderation_permission_cannot_publish(self):
        self.client.force_login(self.staff)
        page = self.client.get(reverse("admin:catalog_service_changelist"))
        self.assertEqual(page.status_code, 200)
        self.assertNotContains(page, 'value="publish_services"')
        self.moderate("publish_services")
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PENDING)
        self.assertFalse(LogEntry.objects.exists())
        self.client.force_login(self.owner)
        self.assertEqual(self.moderate("publish_services").status_code, 302)
        self.assertFalse(LogEntry.objects.exists())

    def test_admin_action_requires_csrf_and_cannot_edit_content(self):
        self.assertEqual(self.client.post(reverse("admin:catalog_service_changelist"), {
            "action": "publish_services", "_selected_action": [self.service.pk],
        }).status_code, 403)
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        self.assertEqual(self.client.post(reverse("admin:catalog_service_change", args=[self.service.pk]),
                                         {"status": "published"}, HTTP_X_CSRFTOKEN=csrf).status_code, 403)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PENDING)

    def test_repeated_decisions_and_demo_records_are_not_moderated(self):
        demo = Service.objects.create(performer=self.owner, title="Демо", description="Описание",
                                      price_amount="1.00", duration_days=1, is_demo=True)
        self.moderate("publish_services", [self.service.pk, demo.pk])
        self.moderate("reject_services")
        self.service.refresh_from_db()
        demo.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PUBLISHED)
        self.assertEqual(demo.status, Service.Status.PENDING)
        self.assertEqual(LogEntry.objects.count(), 1)

    def review(self):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        response = self.client.post(reverse("admin:catalog_service_changelist"), {
            "action": "publish_services", "_selected_action": [self.service.pk],
        }, HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        return response

    def confirm(self, token, action="publish_services", ids=None):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return self.client.post(reverse("admin:catalog_service_changelist"), {
            "action": action, "_selected_action": ids or [self.service.pk],
            "confirm_moderation": "yes", "review_token": token,
        }, HTTP_X_CSRFTOKEN=csrf)

    def test_review_shows_content_escaped_and_does_not_publish_before_confirmation(self):
        self.service.description = "<script>alert('x')</script>"
        self.service.included = ["Разбор вопросов"]
        self.service.save(update_fields=["description", "included"])
        response = self.review()
        self.assertContains(response, "&lt;script&gt;")
        self.assertContains(response, "Разбор вопросов")
        self.assertNotContains(response, self.service.description)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PENDING)
        self.assertFalse(LogEntry.objects.exists())

    def test_stale_review_cannot_publish_edited_content_but_fresh_review_can(self):
        token = self.review().context_data["review_token"]
        owner_client = APIClient(enforce_csrf_checks=True)
        owner_client.force_login(self.owner)
        csrf = owner_client.get(reverse("accounts:csrf")).json()["csrf_token"]
        edited = owner_client.patch(reverse("catalog:own-detail", args=[self.service.pk]),
                                    {"title": "Новое содержание"}, format="json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(self.confirm(token).status_code, 302)
        self.service.refresh_from_db()
        self.assertEqual(self.service.status, Service.Status.PENDING)
        self.assertEqual(self.service.revision, 2)
        self.assertFalse(LogEntry.objects.exists())
        self.assertEqual(self.moderate("publish_services").status_code, 302)
        public = self.client.get(reverse("catalog:detail", args=[self.service.pk]))
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()["title"], "Новое содержание")
        self.assertIn("редакция 2", LogEntry.objects.get().change_message)

    def test_confirmation_rejects_missing_forged_expired_or_other_decision_token(self):
        token = self.review().context_data["review_token"]
        payload = signing.loads(token, salt="catalog.service.moderation")
        with patch("django.core.signing.time.time", return_value=time.time() - 1801):
            expired = signing.dumps(payload, salt="catalog.service.moderation")
        for value, action in (("", "publish_services"), (token + "x", "publish_services"),
                              (expired, "publish_services"), (token, "reject_services")):
            with self.subTest(action=action, token=value[:10]):
                self.assertEqual(self.confirm(value, action).status_code, 302)
                self.service.refresh_from_db()
                self.assertEqual(self.service.status, Service.Status.PENDING)
        self.assertFalse(LogEntry.objects.exists())

    def test_confirmation_cannot_be_reused_by_another_moderator_or_for_another_service(self):
        token = self.review().context_data["review_token"]
        other = Service.objects.create(performer=self.owner, title="Другая", description="Описание",
                                       price_amount="1.00", duration_days=1)
        self.confirm(token, ids=[other.pk])
        self.staff.user_permissions.add(Permission.objects.get(codename="moderate_service"))
        self.client.force_login(self.staff)
        self.confirm(token)
        self.assertEqual(Service.objects.filter(status=Service.Status.PENDING).count(), 2)
        self.assertFalse(LogEntry.objects.exists())
