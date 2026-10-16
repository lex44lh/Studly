"""Серверная регистрация: сессия, приватность, черновик и готовность."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from django.db import connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .models import PerformerProfile, RegistrationProgress, Specialization, User
from .registration import save_registration
from .services import resolve_user
from .telegram import TelegramIdentity
from .tests import BOT_TOKEN, signed_init_data


@override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN)
class RegistrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(72001, display_name="Имя Telegram")
        self.other = User.objects.create_user(72002, display_name="Другой")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)
        self.url = reverse("registration:detail")
        self.complete_url = reverse("registration:complete")

    def write(self, data, method="patch", url=None):
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return getattr(self.client, method)(url or self.url, data, format="json", HTTP_X_CSRFTOKEN=token)

    def test_initial_get_is_private_uncached_and_does_not_create_profiles(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["roles"], [])
        self.assertEqual(response.json()["profile"]["display_name"], self.user.display_name)
        self.assertIsNone(response.json()["performer"])
        self.assertFalse(response.json()["status"]["is_complete"])
        self.assertIn("no-store", response["Cache-Control"])
        self.assertFalse(RegistrationProgress.objects.exists())
        self.assertFalse(PerformerProfile.objects.exists())

    def test_anonymous_and_inactive_user_cannot_read_or_write(self):
        for inactive in (False, True):
            if inactive:
                User.objects.filter(pk=self.user.pk).update(is_active=False)
                self.client.force_login(self.user)
            else:
                self.client.logout()
            for url, method in ((self.url, "get"), (self.url, "patch"),
                                (self.complete_url, "post"), (reverse("registration:avatar"), "get")):
                with self.subTest(inactive=inactive, url=url, method=method):
                    self.assertEqual(getattr(self.client, method)(url, {}, format="json").status_code, 403)

    def test_all_json_writes_require_csrf(self):
        self.assertEqual(self.client.patch(self.url, {"roles": ["customer"]}, format="json").status_code, 403)
        self.assertEqual(self.client.post(self.complete_url, {}, format="json").status_code, 403)
        self.assertFalse(RegistrationProgress.objects.exists())

    @override_settings(CSRF_TRUSTED_ORIGINS=[])
    def test_correct_csrf_does_not_allow_untrusted_origin(self):
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        response = self.client.patch(self.url, {"roles": ["customer"]}, format="json",
                                     HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://untrusted.invalid")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(RegistrationProgress.objects.exists())
        response = self.client.patch(self.url, {"roles": ["customer"]}, format="json",
                                     HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="http://testserver")
        self.assertEqual(response.status_code, 200)

    def test_roles_are_independent_replaceable_and_do_not_grant_staff_permissions(self):
        for roles in (["customer"], ["performer", "customer"], ["performer"], []):
            response = self.write({"roles": roles})
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(set(response.json()["roles"]), set(roles))
            self.user.refresh_from_db()
            self.assertFalse(self.user.is_staff)
            self.assertFalse(self.user.is_superuser)

    def test_partial_fields_merge_and_progress_survives_new_session(self):
        self.write({"roles": ["customer", "performer"], "profile": {
            "display_name": "  Моё имя  ", "university": "Университет", "city": "Москва", "about": "Общее описание",
        }, "progress": {"current_step": "performer"}})
        response = self.write({"profile": {"city": "Казань"}, "performer": {
            "description": "Помогаю с задачами", "study_year": "2 курс", "portfolio": "https://example.org/work\nОписание",
        }})
        self.assertEqual(response.status_code, 200)
        expected = response.json()
        self.assertEqual(expected["profile"]["display_name"], "Моё имя")
        self.assertEqual(expected["profile"]["university"], "Университет")
        self.assertEqual(expected["profile"]["city"], "Казань")
        self.assertEqual(expected["progress"]["current_step"], "performer")
        self.assertIsNotNone(expected["progress"]["updated_at"])
        self.client.logout()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(self.url).json(), expected)
        self.other.refresh_from_db()
        self.assertEqual(self.other.display_name, "Другой")
        self.assertFalse(RegistrationProgress.objects.filter(user=self.other).exists())

    def test_blank_name_is_saved_as_draft_but_cannot_complete(self):
        response = self.write({"roles": ["customer"], "profile": {"display_name": "   "}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile"]["display_name"], "")
        response = self.write({}, "post", self.complete_url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "registration_incomplete")
        self.assertEqual(response.json()["missing_fields"], ["profile.display_name"])
        self.assertIsNone(RegistrationProgress.objects.get(user=self.user).completed_at)

    def test_name_alone_cannot_complete_without_role(self):
        response = self.write({}, "post", self.complete_url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["missing_fields"], ["roles"])

    def test_customer_completes_and_repeat_preserves_completion_time(self):
        self.write({"roles": ["customer"]})
        first = self.write({}, "post", self.complete_url)
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.json()["status"]["is_complete"])
        self.assertFalse(first.json()["status"]["performer_ready"])
        self.assertEqual(self.write({}, "post", self.complete_url).json(), first.json())

    def test_performer_can_skip_profile_and_finish_without_publication_readiness(self):
        self.write({"roles": ["performer"], "progress": {"performer_skipped": True}})
        response = self.write({}, "post", self.complete_url)
        self.assertTrue(response.json()["status"]["is_complete"])
        self.assertFalse(response.json()["status"]["performer_ready"])
        self.assertIsNone(response.json()["performer"])
        self.assertTrue(response.json()["progress"]["performer_skipped"])
        self.assertEqual(response.json()["status"]["performer_missing_fields"], ["performer.specialization_ids"])

    def test_readiness_needs_name_performer_role_and_specialization_only(self):
        specialization = Specialization.objects.create(title="Тестовая специальность")
        self.write({"performer": {"specialization_ids": [str(specialization.pk)]}})
        self.assertFalse(self.client.get(self.url).json()["status"]["performer_ready"])
        response = self.write({"roles": ["performer"]})
        self.assertTrue(response.json()["status"]["performer_ready"])
        self.assertFalse(response.json()["status"]["is_complete"])
        self.assertEqual(response.json()["performer"]["specializations"], [{"id": str(specialization.pk), "title": specialization.title}])
        response = self.write({"profile": {"display_name": ""}})
        self.assertFalse(response.json()["status"]["performer_ready"])

    def test_removing_role_retains_profile_and_clears_invalid_completion(self):
        specialization = Specialization.objects.create(title="Тестовая специальность")
        self.write({"roles": ["performer"], "performer": {
            "description": "Сохраняем", "specialization_ids": [str(specialization.pk)],
        }})
        self.write({}, "post", self.complete_url)
        response = self.write({"roles": []})
        self.assertFalse(response.json()["status"]["is_complete"])
        self.assertIsNone(response.json()["status"]["completed_at"])
        self.assertFalse(response.json()["status"]["performer_ready"])
        self.assertEqual(response.json()["performer"]["description"], "Сохраняем")
        self.assertTrue(PerformerProfile.objects.get(user=self.user).specializations.exists())

    def test_multiple_specializations_have_no_product_count_limit_and_replace_as_set(self):
        Specialization.objects.bulk_create([Specialization(title=f"Тест {i:03}") for i in range(205)])
        ids = list(map(str, Specialization.objects.values_list("pk", flat=True)))
        response = self.write({"performer": {"specialization_ids": ids}})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.json()["performer"]["specializations"]), 205)
        self.write({"performer": {"description": "Список не стирается"}})
        self.assertEqual(PerformerProfile.objects.get().specializations.count(), 205)
        self.assertEqual(self.write({"performer": {"specialization_ids": []}}).json()["performer"]["specializations"], [])

    def test_invalid_nested_data_cannot_partially_save_other_fields(self):
        specialization = Specialization.objects.create(title="Тестовая специальность")
        invalid = (
            {"performer": {"specialization_ids": [str(uuid4())]}},
            {"performer": {"specialization_ids": [str(specialization.pk)] * 2}},
            {"performer": {"specialization_ids": [123]}},
            {"roles": ["admin"]}, {"roles": ["customer", "customer"]},
            {"profile": {"display_name": None}}, {"profile": {"city": "a" * 256}},
            {"progress": {"current_step": "paid"}}, {"performer": None},
        )
        for extra in invalid:
            with self.subTest(extra=extra):
                data = {"profile": {"display_name": "Не сохранять"}, **extra}
                response = self.write(data)
                self.assertEqual(response.status_code, 400, response.content)
                self.user.refresh_from_db()
                self.assertEqual(self.user.display_name, "Имя Telegram")
        self.assertFalse(RegistrationProgress.objects.exists())
        self.assertFalse(PerformerProfile.objects.exists())

    def test_unknown_identity_permissions_status_and_avatar_fields_are_rejected(self):
        for data in ({"user_id": self.other.pk}, {"telegram_id": self.other.telegram_id},
                     {"is_staff": True}, {"status": {"is_complete": True}},
                     {"profile": {"avatar_url": "https://example.org/a.png"}},
                     {"performer": {"commission": 10}}, {"progress": {"completed_at": "now"}}):
            with self.subTest(data=data):
                self.assertEqual(self.write(data).status_code, 400)
        self.assertEqual(self.write({"is_complete": True}, "post", self.complete_url).status_code, 400)
        self.assertFalse(RegistrationProgress.objects.exists())

    def test_empty_patch_and_unsupported_methods_are_rejected(self):
        for data in ({}, {"profile": {}}, {"performer": {}, "progress": {}}):
            self.assertEqual(self.write(data).status_code, 400)
        for method in ("post", "put", "delete"):
            self.assertEqual(self.write({}, method).status_code, 405)

    def test_client_cannot_select_another_users_draft(self):
        save_registration(self.other.pk, {"profile": {"city": "Чужой город"}, "roles": ["performer"]})
        response = self.client.get(self.url, {"user_id": self.other.pk})
        self.assertEqual(response.json()["profile"]["city"], "")
        self.assertEqual(response.json()["roles"], [])

    def test_edited_name_survives_real_login_flow_and_auth_shape_is_unchanged(self):
        self.write({"profile": {"display_name": "Моё имя STUDLY"}})
        self.client.logout()
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        response = self.client.post(reverse("accounts:mini-app"), {"init_data": signed_init_data(user={
            "id": self.user.telegram_id, "first_name": "Другое имя Telegram", "username": "new_username",
        })}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["display_name"], "Моё имя STUDLY")
        self.assertEqual(response.json()["user"]["telegram_username"], "new_username")
        self.assertEqual(set(response.json()["user"]), {"id", "display_name", "telegram_username"})
        self.assertEqual(self.client.get(reverse("accounts:me")).json(), response.json())

    def test_unedited_telegram_name_still_updates(self):
        user = resolve_user(TelegramIdentity(self.user.telegram_id, "Новое имя", ""))
        self.assertEqual(user.display_name, "Новое имя")


class SpecializationTests(TestCase):
    def test_empty_dictionary_is_honest_public_and_read_only(self):
        client = APIClient()
        response = client.get(reverse("registration:specializations"))
        self.assertEqual(response.json(), {"count": 0, "next": None, "previous": None, "results": []})
        self.assertEqual(client.post(reverse("registration:specializations"), {"title": "Запрет"}).status_code, 405)

    def test_search_is_case_insensitive_and_paginated_without_selection_limit(self):
        Specialization.objects.bulk_create([Specialization(title=f"Тест {i:03}") for i in range(105)])
        item = Specialization.objects.create(title="Высшая математика")
        client = APIClient()
        url = reverse("registration:specializations")
        first = client.get(url).json()
        self.assertEqual(first["count"], 106)
        self.assertEqual(len(first["results"]), 100)
        self.assertIsNotNone(first["next"])
        self.assertEqual(len(client.get(url, {"page": 2}).json()["results"]), 6)
        self.assertEqual(client.get(url, {"search": "  МАТЕМ  "}).json()["results"], [{"id": str(item.pk), "title": item.title}])


class ConcurrentRegistrationTests(TransactionTestCase):
    def test_independent_simultaneous_patches_do_not_overwrite_each_other(self):
        user = User.objects.create_user(72901, display_name="Имя")

        def save(data):
            try:
                save_registration(user.pk, data)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(save, [{"profile": {"city": "Казань"}}, {"profile": {"university": "Вуз"}}]))
        user.refresh_from_db()
        self.assertEqual(user.city, "Казань")
        self.assertEqual(user.university, "Вуз")
        self.assertEqual(RegistrationProgress.objects.filter(user=user).count(), 1)
