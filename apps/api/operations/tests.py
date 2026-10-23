from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from django.contrib.auth.models import Permission
from django.db import connections
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accounts.test_workspace import approved_performer
from catalog.models import Favorite, Service
from catalog.workspace import mutate_service
from conversations.models import Conversation, Message
from orders.models import Order, Quote, Tariff
from orders.pricing_v2 import price_snapshot
from orders.workspace import OrdersV2View
from operations.models import AuditEvent


class StaffTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(841001, display_name="Пользователь", email="private@example.com")
        self.staff = User.objects.create_user(841002, is_staff=True)
        self.client = APIClient(enforce_csrf_checks=True)

    def test_capabilities_permission_scoping_and_no_personal_secret_fields(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("staff-session")).status_code, 403)
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get(reverse("staff-session")).json()["resources"], [])
        self.assertEqual(self.client.get(reverse("staff-resource-list", args=["users"])).status_code, 403)
        self.staff.user_permissions.add(Permission.objects.get(codename="view_user"))
        response = self.client.get(reverse("staff-resource-list", args=["users"]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "private@example.com")
        self.assertNotContains(response, "telegram_id")
        self.assertEqual(self.client.get(reverse("staff-resource-list", args=["orders"])).status_code, 403)
        self.assertEqual(self.client.get(reverse("staff-resource-list", args=["unknown"])).status_code, 404)
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        self.assertEqual(self.client.post(reverse("staff-resource-list", args=["users"]), {}, format="json", HTTP_X_CSRFTOKEN=token).status_code, 405)


class ConcurrentIntentTests(TransactionTestCase):
    def setUp(self):
        # TransactionTestCase flush удаляет строки seed-миграции между тестами.
        Tariff.objects.get_or_create(code="buyer-5-v1", defaults={"buyer_fee_percent": "5.00"})
        self.buyer = User.objects.create_user(851001, is_customer=True)
        self.owner = User.objects.create_user(851002, is_performer=True, display_name="Автор")
        approved_performer(self.owner)
        self.service = Service.objects.create(performer=self.owner, title="Python", description="Описание", price_amount=1000,
                                              duration_days=1, status="published")
        self.quote = Quote.objects.create(buyer=self.buyer, service=self.service, snapshot=price_snapshot(self.service, []))

    def race(self, callback):
        barrier = Barrier(2)
        def run(_):
            connections.close_all()
            try:
                client = APIClient(enforce_csrf_checks=True)
                client.force_login(User.objects.get(pk=self.buyer.pk))
                token = client.get(reverse("accounts:csrf")).json()["csrf_token"]
                barrier.wait(timeout=10)
                return callback(client, token)
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run, range(2)))

    def test_parallel_order_intent_has_one_order_and_one_conversation(self):
        key = str(uuid4())
        def call(client, token):
            response = client.post(reverse("orders-v2"), {"quote_id": str(self.quote.pk), "request_key": key}, format="json", HTTP_X_CSRFTOKEN=token)
            return response.status_code, response.json()
        outcomes = self.race(call)
        self.assertEqual(sorted(x[0] for x in outcomes), [200, 201])
        self.assertEqual(outcomes[0][1], outcomes[1][1])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_parallel_favorites_do_not_duplicate(self):
        def call(client, token):
            return client.put(reverse("favorite-detail", args=[self.service.pk]), {}, format="json", HTTP_X_CSRFTOKEN=token).status_code
        self.assertEqual(self.race(call), [204, 204])
        self.assertEqual(Favorite.objects.count(), 1)

    def test_parallel_messages_reuse_single_saved_message(self):
        order = Order.objects.create(buyer=self.buyer, performer=self.owner, service=self.service, service_revision=1,
                request_key=uuid4(), title="Python", description="Описание", duration_days=1,
                price_amount=1000, currency="RUB", buyer_fee_percent=3, buyer_fee_amount=30, total_amount=1030)
        context = Conversation.objects.create(order=order)
        key = str(uuid4())
        def call(client, token):
            return client.post(reverse("messages", args=[context.pk]), {"client_message_id": key, "text": "Уточним задание"}, format="json", HTTP_X_CSRFTOKEN=token).status_code
        self.assertEqual(sorted(self.race(call)), [200, 201])
        self.assertEqual(Message.objects.count(), 1)

    def test_parallel_moderators_cannot_approve_stale_revision(self):
        self.buyer.is_staff = True
        self.buyer.save()
        self.buyer.user_permissions.add(Permission.objects.get(codename="moderate_performer"))
        profile = self.owner.performer_profile
        profile.moderation_status = "pending"
        profile.save()
        def call(client, token):
            return client.post(reverse("performer-decision", args=[self.owner.pk]),
                {"revision": profile.revision, "request_key": str(uuid4()), "decision": "approved"},
                format="json", HTTP_X_CSRFTOKEN=token).status_code
        self.assertEqual(sorted(self.race(call)), [200, 409])
        self.assertEqual(AuditEvent.objects.filter(operation="profile.decide").count(), 1)
