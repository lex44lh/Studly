from io import BytesIO
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from pypdf import PdfWriter
from rest_framework.test import APIClient

from catalog.models import Service
from operations.models import AuditEvent, Receipt
from .models import PerformerProfile, PortfolioExample, User


def approved_performer(user):
    user.is_performer = True
    user.save(update_fields=["is_performer"])
    profile, _ = PerformerProfile.objects.get_or_create(user=user, defaults={"description": "Помогу с Python"})
    PortfolioExample.objects.get_or_create(profile=profile, title="Пример", url="https://example.com/work")
    profile.moderation_status = "approved"
    profile.save()
    return profile


class WorkspaceTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.owner = User.objects.create_user(811001, display_name="Автор", is_performer=True, is_customer=True)
        self.other = User.objects.create_user(811002, display_name="Чужой", is_performer=True)
        self.mod = User.objects.create_user(811003, display_name="Модератор", is_staff=True)
        self.mod.user_permissions.add(Permission.objects.get(codename="moderate_performer"), Permission.objects.get(codename="moderate_service"))
        self.profile = PerformerProfile.objects.create(user=self.owner, description="Помогаю с Python")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)

    def write(self, method, url, data, multipart=False):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return getattr(self.client, method)(url, data, format="multipart" if multipart else "json", HTTP_X_CSRFTOKEN=csrf)

    def example(self):
        self.profile.refresh_from_db()
        response = self.write("post", reverse("portfolio"), {"revision": self.profile.revision,
                              "request_key": str(uuid4()), "title": "Работа", "url": "https://example.com/work"})
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["example"]

    def submit_and_approve(self):
        self.profile.refresh_from_db()
        response = self.write("post", reverse("performer-moderation"), {"revision": self.profile.revision, "request_key": str(uuid4())})
        self.assertEqual(response.status_code, 200, response.content)
        self.client.force_login(self.mod)
        data = {"revision": response.json()["revision"], "decision": "approved", "request_key": str(uuid4())}
        response = self.write("post", reverse("performer-decision", args=[self.owner.pk]), data)
        self.assertEqual(response.status_code, 200, response.content)
        self.client.force_login(self.owner)

    def test_profile_submission_permissions_revision_replay_and_audit(self):
        self.assertEqual(self.write("post", reverse("performer-moderation"), {"revision": 1, "request_key": str(uuid4())}).status_code, 400)
        self.example()
        self.submit_and_approve()
        self.assertEqual(AuditEvent.objects.filter(operation="profile.decide").count(), 1)
        self.assertTrue(self.client.get(reverse("performer-moderation")).json()["approved"])
        self.assertFalse(self.client.get(reverse("account")).json()["registration"]["status"]["performer_ready"])
        self.assertEqual(self.write("post", reverse("performer-decision", args=[self.owner.pk]),
                                    {"revision": 1, "decision": "approved", "request_key": str(uuid4())}).status_code, 403)

    def test_changed_profile_hides_services_and_stale_moderator_cannot_approve(self):
        self.example()
        self.submit_and_approve()
        service = Service.objects.create(performer=self.owner, title="Тест", description="Описание", price_amount=100,
                                         duration_days=1, status="published")
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[service.pk])).status_code, 200)
        old = self.client.get(reverse("performer-moderation")).json()["revision"]
        response = self.write("patch", reverse("registration:detail"), {"performer_revision": old, "performer": {"description": "Новый текст"}})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[service.pk])).status_code, 404)
        self.client.force_login(self.mod)
        response = self.write("post", reverse("performer-decision", args=[self.owner.pk]), {"revision": old, "decision": "approved", "request_key": str(uuid4())})
        self.assertEqual(response.status_code, 409)

    def test_portfolio_replay_bad_urls_and_ownership(self):
        data = {"revision": 1, "request_key": str(uuid4()), "title": "Работа", "url": "https://example.com/work"}
        first = self.write("post", reverse("portfolio"), data)
        second = self.write("post", reverse("portfolio"), data)
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.json(), second.json())
        self.assertEqual(PortfolioExample.objects.count(), 1)
        self.assertEqual(self.write("post", reverse("portfolio"), {**data, "title": "Другое"}).status_code, 409)
        for url in ("javascript:alert(1)", "ftp://example.com/work", "https://user:pass@example.com"):
            self.assertEqual(self.write("post", reverse("portfolio"), {**data, "request_key": str(uuid4()), "url": url}).status_code, 400)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse("portfolio")).json()["count"], 0)
        self.assertEqual(self.write("delete", reverse("portfolio-detail", args=[first.json()["example"]["id"]]),
                                    {"revision": 1, "request_key": str(uuid4())}).status_code, 404)

    def test_noop_preserves_approval_and_removed_selected_work_stays_hidden(self):
        first = self.example()
        self.submit_and_approve()
        revision = self.client.get(reverse("performer-moderation")).json()["revision"]
        self.assertEqual(self.write("patch", reverse("registration:detail"), {"performer_revision": revision}).status_code, 400)
        self.assertEqual(self.write("patch", reverse("registration:detail"), {"profile": {"display_name": self.owner.display_name}}).status_code, 200)
        self.assertTrue(self.client.get(reverse("performer-moderation")).json()["approved"])
        self.assertEqual(self.client.get(reverse("performer-moderation")).json()["revision"], revision)
        service = Service.objects.create(performer=self.owner, title="Python", description="Разбор", price_amount=100,
                                         duration_days=1, status="published")
        service.portfolio_examples.set([first["id"]])
        response = self.write("patch", reverse("portfolio-detail", args=[first["id"]]),
                              {"revision": revision, "request_key": str(uuid4()), "title": "Исправленное название"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["moderation"]["status"], "pending")
        second = self.example()
        self.profile.refresh_from_db()
        response = self.write("delete", reverse("portfolio-detail", args=[first["id"]]),
                              {"revision": self.profile.revision, "request_key": str(uuid4())})
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.client.force_login(self.mod)
        response = self.write("post", reverse("performer-decision", args=[self.owner.pk]),
                              {"revision": self.profile.revision, "request_key": str(uuid4()), "decision": "approved"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.client.get(reverse("catalog:detail", args=[service.pk])).status_code, 404)
        self.assertEqual(PortfolioExample.objects.filter(pk=second["id"], active=True).count(), 1)

    def test_file_validation_private_access_and_no_csrf(self):
        image = BytesIO()
        Image.new("RGB", (8, 8), "red").save(image, "PNG")
        data = {"revision": 1, "request_key": str(uuid4()), "title": "PNG",
                "file": SimpleUploadedFile("evil.html", image.getvalue(), content_type="text/html")}
        response = self.write("post", reverse("portfolio"), data, multipart=True)
        self.assertEqual(response.status_code, 201, response.content)
        url = response.json()["example"]["content_url"]
        self.assertEqual(self.client.get(url).status_code, 200)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_login(self.mod)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.client.force_login(self.owner)
        self.assertEqual(self.client.post(reverse("portfolio"), {}, format="json").status_code, 403)
        for raw in (b"<script>bad</script>", b"%PDF-broken", b"x"*(10*1024*1024+1)):
            self.profile.refresh_from_db()
            response = self.write("post", reverse("portfolio"), {"revision": self.profile.revision, "request_key": str(uuid4()), "title": "Bad",
                                  "file": SimpleUploadedFile("file.pdf", raw)}, multipart=True)
            self.assertEqual(response.status_code, 400, response.content)

    def test_pdf_accepts_plain_and_rejects_javascript(self):
        for active in (False, True):
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            if active:
                writer.add_js("app.alert('bad')")
            buf = BytesIO()
            writer.write(buf)
            self.profile.refresh_from_db()
            response = self.write("post", reverse("portfolio"), {"revision": self.profile.revision, "request_key": str(uuid4()), "title": "PDF",
                                  "file": SimpleUploadedFile("work.pdf", buf.getvalue())}, multipart=True)
            self.assertEqual(response.status_code, 400 if active else 201, response.content)

    def test_draft_submit_decision_and_published_edit(self):
        self.example()
        self.submit_and_approve()
        example_id = str(self.profile.examples.first().pk)
        data = {"revision": 0, "request_key": str(uuid4()), "title": "Python", "description": "Разбор",
                "category": "programming", "price_amount": "1000.00", "duration_days": 3,
                "included": ["Разбор"], "portfolio_example_ids": [example_id],
                "extras": [{"id": str(uuid4()), "title": "Отчёт", "price_amount": "300.00", "extra_days": 1}]}
        response = self.write("post", reverse("own-services-v2"), data)
        self.assertEqual(response.status_code, 201, response.content)
        item = response.json()
        self.assertEqual(item["status"], "draft")
        self.assertEqual(self.write("post", reverse("own-services-v2"), data).json(), item)
        response = self.write("post", reverse("service-submit", args=[item["id"]]), {"revision": item["revision"], "request_key": str(uuid4())})
        self.assertEqual(response.status_code, 200, response.content)
        self.client.force_login(self.mod)
        response = self.write("post", reverse("service-decision", args=[item["id"]]), {"revision": response.json()["revision"], "request_key": str(uuid4()), "decision": "approved"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.client.get(reverse("service-v2", args=[item["id"]])).status_code, 200)
        self.client.force_login(self.owner)
        response = self.write("patch", reverse("own-service-v2", args=[item["id"]]), {"revision": response.json()["revision"], "request_key": str(uuid4()), "title": "Изменено"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "pending")
        self.assertEqual(self.client.get(reverse("service-v2", args=[item["id"]])).status_code, 404)

    def test_service_cannot_submit_without_approval_or_use_foreign_work(self):
        response = self.write("post", reverse("own-services-v2"), {"revision": 0, "request_key": str(uuid4())})
        self.assertEqual(response.status_code, 201)
        item = response.json()
        submitted = self.write("post", reverse("service-submit", args=[item["id"]]), {"revision": item["revision"], "request_key": str(uuid4())})
        self.assertEqual(submitted.status_code, 400)
        foreign = approved_performer(self.other).examples.first()
        response = self.write("patch", reverse("own-service-v2", args=[item["id"]]),
                              {"revision": item["revision"], "request_key": str(uuid4()), "portfolio_example_ids": [str(foreign.pk)]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get(reverse("services-v2")).json()["count"], 0)

    def test_staff_cannot_moderate_own_profile_and_rejection_needs_reason(self):
        self.owner.is_staff = True
        self.owner.save()
        self.owner.user_permissions.add(Permission.objects.get(codename="moderate_performer"))
        response = self.write("post", reverse("performer-decision", args=[self.owner.pk]),
                              {"revision": 1, "request_key": str(uuid4()), "decision": "approved"})
        self.assertEqual(response.status_code, 403)
        self.client.force_login(self.mod)
        self.assertEqual(self.write("post", reverse("performer-decision", args=[self.owner.pk]),
                              {"revision": 1, "request_key": str(uuid4()), "decision": "rejected"}).status_code, 400)
        self.assertEqual(self.write("post", reverse("performer-decision", args=[2**62]),
                              {"revision": 1, "request_key": str(uuid4()), "decision": "approved"}).status_code, 404)
