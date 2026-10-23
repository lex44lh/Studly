from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError, connections, transaction
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accounts.test_workspace import approved_performer
from catalog.models import Service
from .models import Order
from .services import OrderConflict, accept_order, create_order


def make_service(performer, **overrides):
    return Service.objects.create(**{
        "performer": performer, "title": "Консультация по Python",
        "description": "Разберём вопросы", "price_amount": Decimal("1000.00"),
        "duration_days": 3, "included": ["Один час консультации"],
        "status": Service.Status.PUBLISHED, **overrides,
    })


class OrderAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.buyer = User.objects.create_user(60001, display_name="Заказчик", is_customer=True)
        cls.performer = User.objects.create_user(
            60002, display_name="Исполнитель", email="private@example.com", is_performer=True, is_customer=True,
        )
        cls.other = User.objects.create_user(60003, display_name="Другой пользователь", is_customer=True)
        cls.service = make_service(cls.performer)
        approved_performer(cls.performer)

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.buyer)
        self.list_url = reverse("orders:list")
        self.data = {
            "service_id": self.service.pk, "service_revision": 1,
            "request_key": str(uuid4()),
        }

    def write(self, method, url, data, **kwargs):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return getattr(self.client, method)(
            url, data, format="json", HTTP_X_CSRFTOKEN=csrf, **kwargs
        )

    def create(self, **overrides):
        return self.write("post", self.list_url, {**self.data, **overrides})

    def create_order(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.content)
        return Order.objects.get(pk=response.json()["id"])

    def test_create_saves_server_conditions_and_only_public_participant_fields(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(set(data), {
            "id", "service_id", "service_revision", "request_key", "buyer", "performer",
            "title", "description", "included", "duration_days", "price_amount", "currency",
            "buyer_fee_percent", "buyer_fee_amount", "total_amount", "status",
            "created_at", "accepted_at", "closed_at", "closed_by",
        })
        self.assertEqual(data["buyer"], {"id": self.buyer.pk, "name": "Заказчик"})
        self.assertEqual(data["performer"], {"id": self.performer.pk, "name": "Исполнитель"})
        self.assertEqual(data["service_id"], self.service.pk)
        self.assertEqual(data["service_revision"], 1)
        self.assertEqual(data["title"], self.service.title)
        self.assertEqual(data["description"], self.service.description)
        self.assertEqual(data["included"], self.service.included)
        self.assertEqual(data["duration_days"], 3)
        self.assertEqual(data["price_amount"], "1000.00")
        self.assertEqual(data["currency"], "RUB")
        self.assertEqual(data["buyer_fee_percent"], "3.00")
        self.assertEqual(data["buyer_fee_amount"], "30.00")
        self.assertEqual(data["total_amount"], "1030.00")
        self.assertEqual(data["status"], "pending_acceptance")
        self.assertIsNone(data["accepted_at"])
        self.assertIsNone(data["closed_at"])
        self.assertIsNone(data["closed_by"])
        self.assertIn("no-store", response["Cache-Control"])
        self.assertNotContains(response, "private@example.com", status_code=201)
        self.assertEqual(Order.objects.count(), 1)

    def test_order_amounts_preserve_kopeck_rounding_and_maximum_price(self):
        for price, fee, total in (
            ("0.01", "0.00", "0.01"), ("0.50", "0.02", "0.52"),
            ("99999999.99", "3000000.00", "102999999.99"),
        ):
            with self.subTest(price=price):
                Service.objects.filter(pk=self.service.pk).update(price_amount=price)
                response = self.create(request_key=str(uuid4()))
                self.assertEqual(response.status_code, 201, response.content)
                order = Order.objects.get(pk=response.json()["id"])
                self.assertEqual(order.price_amount, Decimal(price))
                self.assertEqual(order.buyer_fee_amount, Decimal(fee))
                self.assertEqual(order.total_amount, Decimal(total))

    def test_cannot_supply_amounts_participants_status_or_service_snapshot(self):
        for field, value in {
            "id": 99, "buyer": self.other.pk, "performer": self.other.pk,
            "price_amount": "1.00", "currency": "USD", "buyer_fee_percent": "0.00",
            "buyer_fee_amount": "0.00", "total_amount": "1.00", "status": "completed",
            "accepted_at": "2026-10-16T12:00:00Z", "title": "Другие условия",
            "description": "Из браузера", "included": [], "duration_days": 1,
            "performer_fee_percent": "10.00", "is_demo": False,
        }.items():
            with self.subTest(field=field):
                response = self.create(**{field: value})
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn(field, response.json())
        self.assertEqual(Order.objects.count(), 0)

    def test_invalid_create_payloads_do_not_create_orders(self):
        for data in ({}, [], None, {**self.data, "service_id": 0},
                     {**self.data, "service_id": 2**63}, {**self.data, "service_id": True},
                     {**self.data, "service_revision": 0},
                     {**self.data, "service_revision": 2**63},
                     {**self.data, "request_key": "wrong-key"}):
            with self.subTest(data=data):
                response = self.write("post", self.list_url, data)
                self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Order.objects.count(), 0)

    def test_only_existing_published_services_can_be_ordered(self):
        for status in (Service.Status.PENDING, Service.Status.REJECTED):
            with self.subTest(status=status):
                Service.objects.filter(pk=self.service.pk).update(status=status)
                self.assertEqual(self.create().status_code, 404)
        self.assertEqual(self.create(service_id=2**62).status_code, 404)
        self.assertEqual(Order.objects.count(), 0)

    def test_demo_free_own_inactive_and_unsupported_currency_services_are_rejected(self):
        for changes in ({"is_demo": True}, {"price_amount": "0.00"}, {"currency": "USD"}):
            with self.subTest(changes=changes):
                Service.objects.filter(pk=self.service.pk).update(**changes)
                self.assertEqual(self.create().status_code, 400)
                Service.objects.filter(pk=self.service.pk).update(
                    is_demo=False, price_amount="1000.00", currency="RUB"
                )
        self.client.force_login(self.performer)
        self.assertEqual(self.create().status_code, 400)
        self.client.force_login(self.buyer)
        User.objects.filter(pk=self.performer.pk).update(is_active=False)
        self.assertEqual(self.create().status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_stale_revision_requires_new_quote_and_leaves_no_order(self):
        Service.objects.filter(pk=self.service.pk).update(price_amount="2000.00", revision=2)
        response = self.create()
        self.assertEqual(response.status_code, 409, response.content)
        self.assertIn("service_revision", response.json())
        self.assertEqual(Order.objects.count(), 0)
        quote = self.client.get(reverse("catalog:quote", args=[self.service.pk])).json()
        response = self.create(service_revision=quote["service_revision"])
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["total_amount"], "2060.00")

    def test_same_key_returns_existing_order_even_after_service_or_order_changes(self):
        created = self.create()
        order_id = created.json()["id"]
        self.client.force_login(self.performer)
        self.assertEqual(self.write("post", reverse("orders:accept", args=[order_id]), {}).status_code, 200)
        self.assertEqual(self.write("patch", reverse("catalog:own-detail", args=[self.service.pk]), {
            "price_amount": "2000.00", "title": "Новый текст",
        }).status_code, 200)
        self.client.force_login(self.buyer)
        repeated = self.create()
        self.assertEqual(repeated.status_code, 200, repeated.content)
        self.assertEqual(repeated.json()["id"], order_id)
        self.assertEqual(repeated.json()["status"], "awaiting_payment")
        self.assertEqual(repeated.json()["price_amount"], "1000.00")
        self.assertEqual(Order.objects.count(), 1)

    def test_reusing_key_for_another_revision_or_service_is_conflict(self):
        order = self.create_order()
        other_service = make_service(self.performer)
        for overrides in ({"service_revision": 2}, {"service_id": other_service.pk}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.create(**overrides).status_code, 409)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Order.objects.get().pk, order.pk)

    def test_idempotency_key_is_scoped_to_buyer_and_new_key_creates_new_order(self):
        self.create_order()
        self.assertEqual(self.create(request_key=str(uuid4())).status_code, 201)
        self.client.force_login(self.other)
        self.assertEqual(self.create().status_code, 201)
        self.assertEqual(Order.objects.count(), 3)

    def test_editing_source_does_not_change_snapshot_or_block_acceptance(self):
        order = self.create_order()
        original = self.client.get(reverse("orders:detail", args=[order.pk])).json()
        self.client.force_login(self.performer)
        edited = self.write("patch", reverse("catalog:own-detail", args=[self.service.pk]), {
            "title": "Другое название", "description": "Новое описание", "included": [],
            "price_amount": "2000.00", "duration_days": 8,
        })
        self.assertEqual(edited.status_code, 200, edited.content)
        self.assertEqual(edited.json()["status"], "pending")
        unchanged = self.client.get(reverse("orders:detail", args=[order.pk]))
        self.assertEqual(unchanged.json(), original)
        accepted = self.write("post", reverse("orders:accept", args=[order.pk]), {})
        self.assertEqual(accepted.status_code, 200, accepted.content)
        for field in ("title", "description", "included", "duration_days", "price_amount",
                      "buyer_fee_percent", "buyer_fee_amount", "total_amount", "service_revision"):
            self.assertEqual(accepted.json()[field], original[field])

    def test_participants_can_read_but_strangers_cannot_discover_order(self):
        order = self.create_order()
        detail = reverse("orders:detail", args=[order.pk])
        accept = reverse("orders:accept", args=[order.pk])
        for participant in (self.buyer, self.performer):
            self.client.force_login(participant)
            response = self.client.get(detail)
            self.assertEqual(response.status_code, 200)
            self.assertIn("no-store", response["Cache-Control"])
            self.assertEqual(self.client.get(self.list_url).json()["count"], 1)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.list_url).json()["count"], 0)
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.write("post", accept, {}).status_code, 404)
        for pk in (0, 2**62, 2**63):
            self.assertEqual(self.client.get(reverse("orders:detail", args=[pk])).status_code, 404)
            self.assertEqual(self.write("post", reverse("orders:accept", args=[pk]), {}).status_code, 404)

    def test_list_includes_both_roles_excludes_other_orders_and_is_paginated(self):
        self.create_order()
        approved_performer(self.buyer)
        buyer_service = make_service(self.buyer)
        create_order(buyer=self.other, data={
            "service_id": buyer_service.pk, "service_revision": 1, "request_key": uuid4(),
        })
        for _ in range(20):
            create_order(buyer=self.buyer, data={**self.data, "request_key": uuid4()})
        create_order(buyer=self.other, data={**self.data, "request_key": uuid4()})
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        page = response.json()
        self.assertEqual(page["count"], 22)
        self.assertEqual(len(page["results"]), 20)
        ids = [row["id"] for row in page["results"]]
        self.assertEqual(ids, sorted(ids, reverse=True))
        next_page = self.client.get(page["next"]).json()
        self.assertEqual(len(next_page["results"]), 2)
        self.assertIsNone(next_page["next"])

    def test_only_performer_can_accept_and_repeated_acceptance_keeps_timestamp(self):
        order = self.create_order()
        url = reverse("orders:accept", args=[order.pk])
        self.assertEqual(self.write("post", url, {}).status_code, 403)
        self.client.force_login(self.performer)
        accepted = self.write("post", url, {})
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertEqual(accepted.json()["status"], "awaiting_payment")
        self.assertIsNotNone(accepted.json()["accepted_at"])
        repeated = self.write("post", url, {})
        self.assertEqual(repeated.status_code, 200, repeated.content)
        self.assertEqual(repeated.json(), accepted.json())
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.AWAITING_PAYMENT)
        self.assertEqual(order.total_amount, Decimal("1030.00"))

    def test_acceptance_rejects_fields_instead_of_overriding_conditions(self):
        order = self.create_order()
        self.client.force_login(self.performer)
        url = reverse("orders:accept", args=[order.pk])
        for data in ({"status": "completed"}, {"price_amount": "2000.00"}, []):
            with self.subTest(data=data):
                self.assertEqual(self.write("post", url, data).status_code, 400)
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        self.assertEqual(self.client.post(
            url, "null", content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        ).status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_ACCEPTANCE)
        self.assertIsNone(order.accepted_at)

    def test_private_routes_require_active_session(self):
        order = self.create_order()
        detail = reverse("orders:detail", args=[order.pk])
        accept = reverse("orders:accept", args=[order.pk])
        self.client.logout()
        for response in (self.client.get(self.list_url), self.client.get(detail),
                         self.write("post", self.list_url, self.data), self.write("post", accept, {})):
            self.assertEqual(response.status_code, 403)
        User.objects.filter(pk=self.buyer.pk).update(is_active=False)
        self.client.force_login(self.buyer)
        self.assertEqual(self.client.get(detail).status_code, 403)
        self.assertEqual(self.create(request_key=str(uuid4())).status_code, 403)
        self.assertEqual(Order.objects.count(), 1)

    def test_creation_and_acceptance_require_csrf(self):
        self.assertEqual(self.client.post(self.list_url, self.data, format="json").status_code, 403)
        order = self.create_order()
        self.client.force_login(self.performer)
        self.assertEqual(self.client.post(
            reverse("orders:accept", args=[order.pk]), {}, format="json"
        ).status_code, 403)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_ACCEPTANCE)

    def test_non_json_and_malformed_requests_are_rejected_without_writes(self):
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        response = self.client.post(self.list_url, self.data, format="multipart", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 415)
        response = self.client.post(
            self.list_url, "{broken", content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_orders_cannot_be_changed_deleted_paid_or_started_by_arbitrary_writes(self):
        order = self.create_order()
        detail = reverse("orders:detail", args=[order.pk])
        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                self.assertEqual(self.write(method, detail, {"status": "completed"}).status_code, 405)
        self.assertEqual(self.client.get(reverse("orders:accept", args=[order.pk])).status_code, 405)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_ACCEPTANCE)
        self.assertEqual(Order.objects.count(), 1)

    def test_browsable_api_shows_private_orders_using_the_same_session(self):
        self.create_order()
        response = self.client.get(self.list_url, HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "pending_acceptance")
        self.assertContains(response, "1030.00")

    def test_database_rejects_inconsistent_money_and_acceptance_state(self):
        order = self.create_order()
        for changes in ({"total_amount": "1000.00"}, {"price_amount": "0.00"},
                        {"buyer_fee_amount": "-1.00"}, {"currency": "USD"},
                        {"performer_id": self.buyer.pk}, {"status": "completed"},
                        {"status": "awaiting_payment", "accepted_at": None}):
            with self.subTest(changes=changes):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Order.objects.filter(pk=order.pk).update(**changes)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_ACCEPTANCE)
        self.assertEqual(order.total_amount, Decimal("1030.00"))


class ConcurrentOrderTests(TransactionTestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(61001, is_customer=True)
        self.performer = User.objects.create_user(61002)
        approved_performer(self.performer)
        self.service = make_service(self.performer)
        self.data = {"service_id": self.service.pk, "service_revision": 1, "request_key": uuid4()}

    def test_simultaneous_same_request_creates_one_order(self):
        barrier = Barrier(2)

        def create(_):
            try:
                barrier.wait(timeout=10)
                order, created = create_order(buyer=self.buyer, data=self.data)
                return order.pk, created
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(create, range(2)))
        self.assertEqual(results[0][0], results[1][0])
        self.assertCountEqual([created for _, created in results], [True, False])
        self.assertEqual(Order.objects.count(), 1)

    def test_simultaneous_key_reuse_for_different_services_has_one_winner(self):
        other_service = make_service(self.performer)
        barrier = Barrier(2)
        def create(service_id):
            try:
                try:
                    # Новая проверка роли блокирует аккаунты до вставки.
                    # Одновременный вход проверяем до этой сериализации.
                    barrier.wait(timeout=10)
                    order, _ = create_order(buyer=self.buyer, data={**self.data, "service_id": service_id})
                    return order.pk, "created"
                except OrderConflict:
                    return None, "conflict"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(create, [self.service.pk, other_service.pk]))
        self.assertCountEqual([outcome for _, outcome in results], ["created", "conflict"])
        self.assertEqual(Order.objects.count(), 1)

    def test_simultaneous_acceptance_sets_one_timestamp(self):
        order, _ = create_order(buyer=self.buyer, data=self.data)
        barrier = Barrier(2)

        def accept(_):
            try:
                barrier.wait(timeout=10)
                accepted = accept_order(user=self.performer, pk=order.pk)
                return accepted.accepted_at
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            timestamps = list(pool.map(accept, range(2)))
        self.assertEqual(timestamps[0], timestamps[1])
        order.refresh_from_db()
        self.assertEqual(order.accepted_at, timestamps[0])
        self.assertEqual(order.status, Order.Status.AWAITING_PAYMENT)
