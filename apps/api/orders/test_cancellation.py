from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from django.db import IntegrityError, connections, transaction
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from .models import Order
from .services import OrderConflict, accept_order, cancel_order, create_order, decline_order
from .tests import make_service


class UnpaidOrderClosureTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.buyer = User.objects.create_user(62001, display_name="Заказчик")
        cls.performer = User.objects.create_user(62002, display_name="Исполнитель")
        cls.other = User.objects.create_user(62003)
        cls.service = make_service(cls.performer)

    def setUp(self):
        self.data = {"service_id": self.service.pk, "service_revision": 1, "request_key": str(uuid4())}
        self.order, _ = create_order(buyer=self.buyer, data=self.data)
        self.order.refresh_from_db()
        self.conditions = {
            field: getattr(self.order, field)
            for field in ("buyer_id", "performer_id", "service_id", "service_revision", "request_key",
                          "title", "description", "included", "duration_days", "price_amount", "currency",
                          "buyer_fee_percent", "buyer_fee_amount", "total_amount", "created_at")
        }
        self.client = APIClient(enforce_csrf_checks=True)

    def post(self, action, user, data=None):
        self.client.force_login(user)
        csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return self.client.post(
            reverse(f"orders:{action}", args=[self.order.pk]), {} if data is None else data,
            format="json", HTTP_X_CSRFTOKEN=csrf,
        )

    def assert_conditions_unchanged(self):
        self.order.refresh_from_db()
        for field, value in self.conditions.items():
            self.assertEqual(getattr(self.order, field), value, field)

    def test_buyer_can_cancel_before_acceptance_and_both_participants_keep_access(self):
        response = self.post("cancel", self.buyer)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual(data["status"], "cancelled")
        self.assertIsNotNone(data["closed_at"])
        self.assertEqual(data["closed_by"], {"id": self.buyer.pk, "name": "Заказчик"})
        self.assertIsNone(data["accepted_at"])
        self.assertIn("no-store", response["Cache-Control"])
        for user in (self.buyer, self.performer):
            self.client.force_login(user)
            self.assertEqual(self.client.get(reverse("orders:detail", args=[self.order.pk])).json(), data)
            page = self.client.get(reverse("orders:list")).json()
            self.assertEqual(page["count"], 1)
            self.assertEqual(page["results"][0], data)
        self.assert_conditions_unchanged()

    def test_buyer_can_cancel_awaiting_payment_and_acceptance_history_is_preserved(self):
        accepted = self.post("accept", self.performer)
        self.assertEqual(accepted.status_code, 200, accepted.content)
        response = self.post("cancel", self.buyer)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "cancelled")
        self.assertEqual(response.json()["accepted_at"], accepted.json()["accepted_at"])
        self.assertEqual(response.json()["closed_by"]["id"], self.buyer.pk)
        self.assert_conditions_unchanged()

    def test_performer_can_decline_before_agreement(self):
        response = self.post("decline", self.performer)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual(data["status"], "declined")
        self.assertIsNotNone(data["closed_at"])
        self.assertEqual(data["closed_by"], {"id": self.performer.pk, "name": "Исполнитель"})
        self.assertIsNone(data["accepted_at"])
        self.assertIn("no-store", response["Cache-Control"])
        self.assert_conditions_unchanged()

    def test_performer_cannot_decline_after_agreement(self):
        accepted = self.post("accept", self.performer)
        self.assertEqual(accepted.status_code, 200, accepted.content)
        declined = self.post("decline", self.performer)
        self.assertEqual(declined.status_code, 409, declined.content)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.AWAITING_PAYMENT)
        self.assertIsNone(self.order.closed_at)
        self.assertIsNone(self.order.closed_by_id)

    def test_only_correct_role_can_perform_closure(self):
        for action, user in (("cancel", self.performer), ("decline", self.buyer)):
            with self.subTest(action=action):
                response = self.post(action, user)
                self.assertEqual(response.status_code, 403, response.content)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING_ACCEPTANCE)
        self.assertIsNone(self.order.closed_at)

    def test_strangers_and_missing_ids_return_404(self):
        for action, actor in (("cancel", self.buyer), ("decline", self.performer)):
            with self.subTest(action=action):
                self.assertEqual(self.post(action, self.other).status_code, 404)
                self.client.force_login(actor)
                csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
                for pk in (0, 2**62, 2**63):
                    response = self.client.post(
                        reverse(f"orders:{action}", args=[pk]), {}, format="json", HTTP_X_CSRFTOKEN=csrf
                    )
                    self.assertEqual(response.status_code, 404)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.closed_at)

    def test_closure_requires_active_session_and_csrf(self):
        for action, actor in (("cancel", self.buyer), ("decline", self.performer)):
            with self.subTest(action=action):
                url = reverse(f"orders:{action}", args=[self.order.pk])
                self.client.logout()
                self.assertEqual(self.client.post(url, {}, format="json").status_code, 403)
                self.client.force_login(actor)
                self.assertEqual(self.client.post(url, {}, format="json").status_code, 403)
                User.objects.filter(pk=actor.pk).update(is_active=False)
                self.assertEqual(self.post(action, actor).status_code, 403)
                User.objects.filter(pk=actor.pk).update(is_active=True)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.closed_at)

    def test_client_cannot_supply_closure_history_money_or_status(self):
        for action, actor in (("cancel", self.buyer), ("decline", self.performer)):
            for field, value in {
                "closed_by": self.other.pk, "closed_at": "2026-10-16T10:00:00Z",
                "accepted_at": "2026-10-16T10:00:00Z", "status": "completed",
                "total_amount": "0.00", "buyer_fee_percent": "0.00",
                "reason": "Ещё не согласованное поле",
            }.items():
                with self.subTest(action=action, field=field):
                    response = self.post(action, actor, {field: value})
                    self.assertEqual(response.status_code, 400, response.content)
                    self.assertIn(field, response.json())
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING_ACCEPTANCE)
        self.assertIsNone(self.order.closed_at)

    def test_closure_rejects_invalid_json_and_non_json(self):
        for action, actor in (("cancel", self.buyer), ("decline", self.performer)):
            self.client.force_login(actor)
            csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
            url = reverse(f"orders:{action}", args=[self.order.pk])
            for content in ("null", "[]", "{broken"):
                with self.subTest(action=action, content=content):
                    response = self.client.post(
                        url, content, content_type="application/json", HTTP_X_CSRFTOKEN=csrf
                    )
                    self.assertEqual(response.status_code, 400)
            self.assertEqual(self.client.post(
                url, {"status": "cancelled"}, format="multipart", HTTP_X_CSRFTOKEN=csrf
            ).status_code, 415)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.closed_at)

    def test_closure_accepts_only_post(self):
        for action, actor in (("cancel", self.buyer), ("decline", self.performer)):
            self.client.force_login(actor)
            csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
            url = reverse(f"orders:{action}", args=[self.order.pk])
            self.assertEqual(self.client.get(url).status_code, 405)
            for method in ("put", "patch", "delete"):
                self.assertEqual(getattr(self.client, method)(
                    url, {}, format="json", HTTP_X_CSRFTOKEN=csrf
                ).status_code, 405)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.closed_at)

    def test_repeated_cancel_is_idempotent(self):
        first = self.post("cancel", self.buyer)
        repeated = self.post("cancel", self.buyer)
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(repeated.status_code, 200, repeated.content)
        self.assertEqual(repeated.json(), first.json())
        self.assert_conditions_unchanged()

    def test_repeated_decline_is_idempotent(self):
        first = self.post("decline", self.performer)
        repeated = self.post("decline", self.performer)
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(repeated.status_code, 200, repeated.content)
        self.assertEqual(repeated.json(), first.json())
        self.assert_conditions_unchanged()

    def test_cancelled_order_cannot_be_accepted_or_declined(self):
        closed = self.post("cancel", self.buyer)
        self.assertEqual(closed.status_code, 200, closed.content)
        for action in ("accept", "decline"):
            self.assertEqual(self.post(action, self.performer).status_code, 409)
        self.assertEqual(self.client.get(reverse("orders:detail", args=[self.order.pk])).json(), closed.json())

    def test_declined_order_cannot_be_accepted_or_cancelled(self):
        closed = self.post("decline", self.performer)
        self.assertEqual(closed.status_code, 200, closed.content)
        self.assertEqual(self.post("accept", self.performer).status_code, 409)
        self.assertEqual(self.post("cancel", self.buyer).status_code, 409)
        self.assertEqual(self.client.get(reverse("orders:detail", args=[self.order.pk])).json(), closed.json())

    def test_repeating_create_returns_closed_order_instead_of_new_one(self):
        for action, actor in (("cancel", self.buyer), ("decline", self.performer)):
            with self.subTest(action=action):
                if action == "decline":
                    self.data = {**self.data, "request_key": str(uuid4())}
                    self.order, _ = create_order(buyer=self.buyer, data=self.data)
                closed = self.post(action, actor)
                self.assertEqual(closed.status_code, 200, closed.content)
                count = Order.objects.count()
                self.client.force_login(self.buyer)
                csrf = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
                repeated = self.client.post(reverse("orders:list"), self.data, format="json", HTTP_X_CSRFTOKEN=csrf)
                self.assertEqual(repeated.status_code, 200, repeated.content)
                self.assertEqual(repeated.json(), closed.json())
                self.assertEqual(Order.objects.count(), count)

    def test_database_rejects_invalid_closure_actor_time_or_acceptance_history(self):
        now = timezone.now()
        for changes in (
            {"closed_at": now}, {"closed_by_id": self.buyer.pk},
            {"status": "cancelled"},
            {"status": "cancelled", "closed_at": now, "closed_by_id": None},
            {"status": "cancelled", "closed_at": now, "closed_by_id": self.performer.pk},
            {"status": "declined", "closed_at": now, "closed_by_id": self.buyer.pk},
            {"status": "declined", "closed_at": now, "closed_by_id": self.performer.pk, "accepted_at": now},
        ):
            with self.subTest(changes=changes):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Order.objects.filter(pk=self.order.pk).update(**changes)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING_ACCEPTANCE)
        self.assertIsNone(self.order.closed_at)


class ConcurrentOrderClosureTests(TransactionTestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(63001)
        self.performer = User.objects.create_user(63002)
        service = make_service(self.performer)
        self.order, _ = create_order(buyer=self.buyer, data={
            "service_id": service.pk, "service_revision": 1, "request_key": uuid4(),
        })

    def simultaneous(self, actions):
        barrier = Barrier(len(actions))

        def run(action):
            operation, user = action
            try:
                barrier.wait(timeout=10)
                try:
                    order = operation(user=user, pk=self.order.pk)
                    return order.status, order.accepted_at, order.closed_at, order.closed_by_id
                except OrderConflict:
                    return "conflict", None, None, None
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(actions)) as pool:
            return list(pool.map(run, actions))

    def test_simultaneous_cancel_and_accept_always_end_cancelled(self):
        cancelled, accepted = self.simultaneous([(cancel_order, self.buyer), (accept_order, self.performer)])
        self.assertEqual(cancelled[0], Order.Status.CANCELLED)
        self.assertIn(accepted[0], (Order.Status.AWAITING_PAYMENT, "conflict"))
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.CANCELLED)
        self.assertEqual(self.order.closed_by_id, self.buyer.pk)
        self.assertEqual(self.order.accepted_at, accepted[1])

    def test_simultaneous_decline_and_accept_have_one_winner(self):
        results = self.simultaneous([(decline_order, self.performer), (accept_order, self.performer)])
        states = [result[0] for result in results]
        self.assertEqual(states.count("conflict"), 1)
        self.order.refresh_from_db()
        self.assertIn(self.order.status, (Order.Status.DECLINED, Order.Status.AWAITING_PAYMENT))
        self.assertIn(self.order.status, states)

    def test_simultaneous_repeated_cancel_preserves_one_closure_timestamp(self):
        results = self.simultaneous([(cancel_order, self.buyer), (cancel_order, self.buyer)])
        self.assertEqual(results[0], results[1])
        self.assertEqual(results[0][0], Order.Status.CANCELLED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.closed_at, results[0][2])
        self.assertEqual(self.order.closed_by_id, self.buyer.pk)

    def test_simultaneous_cancel_and_decline_preserve_first_closure(self):
        results = self.simultaneous([(cancel_order, self.buyer), (decline_order, self.performer)])
        self.assertEqual([result[0] for result in results].count("conflict"), 1)
        self.order.refresh_from_db()
        winner = next(result for result in results if result[0] != "conflict")
        self.assertEqual(self.order.status, winner[0])
        self.assertEqual(self.order.closed_at, winner[2])
        self.assertEqual(self.order.closed_by_id, winner[3])
