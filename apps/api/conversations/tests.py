from uuid import uuid4

from django.contrib.auth.models import Permission
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Service
from operations.models import AuditEvent
from orders.models import Order
from .models import Conversation, Message, SecurityCase
from .rules import classify


class RuleTests(SimpleTestCase):
    def test_critical_phrases_and_false_positive_examples(self):
        for text in ("Давай перейдём в Telegram", "Напиши мне в WhatsApp", "Скинь номер телефона", "Переведи на карту, будет дешевле",
                     "Оплати напрямую", "Мой Telegram @mycontact", "https://t.me/mycontact", "Давай перейдём в теле\u200bграм"):
            self.assertTrue(classify(text), text)
        for text in ("Нужно написать Telegram-бота на Python", "Объясни Telegram API", "Условие задания https://t.me/course/123",
                     'В задании «оплати напрямую» приведён пример нарушения', "Результат работы загрузил в STUDLY", "Сумма 1300 рублей"):
            self.assertEqual(classify(text), [], text)


class ConversationTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(831001, display_name="Заказчик")
        self.owner = User.objects.create_user(831002, display_name="Исполнитель")
        self.other = User.objects.create_user(831003, is_staff=True)
        service = Service.objects.create(performer=self.owner, title="Тест", description="Описание", price_amount=100, duration_days=1)
        self.order = Order.objects.create(buyer=self.buyer, performer=self.owner, service=service, service_revision=1, request_key=uuid4(),
                title="Тест", description="Описание", duration_days=1, price_amount=100, currency="RUB",
                buyer_fee_percent=3, buyer_fee_amount=3, total_amount=103)
        self.conversation = Conversation.objects.create(order=self.order)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.buyer)
        self.url = reverse("messages", args=[self.conversation.pk])

    def write(self, method, url, data):
        token = self.client.get(reverse("accounts:csrf")).json()["csrf_token"]
        return getattr(self.client, method)(url, data, format="json", HTTP_X_CSRFTOKEN=token)

    def test_shared_context_author_timestamp_idempotency_and_ownership(self):
        data = {"client_message_id": str(uuid4()), "text": "Здравствуйте, уточним задание"}
        first = self.write("post", self.url, data)
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.json()["sender_id"], self.buyer.pk)
        self.assertEqual(first.json()["status"], "stored")
        self.assertEqual(self.write("post", self.url, data).json(), first.json())
        self.assertEqual(self.write("post", self.url, {**data, "text": "Другой текст"}).status_code, 409)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.url).json()["results"][0]["id"], first.json()["id"])
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.write("post", self.url, data).status_code, 404)
        self.assertEqual(Message.objects.count(), 1)

    def test_held_message_recipient_privacy_appeal_and_manual_release(self):
        response = self.write("post", self.url, {"client_message_id": str(uuid4()), "text": "Давай перейдём в Telegram"})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["status"], "held")
        case_id = response.json()["security_case_id"]
        original_sequence = response.json()["sequence"]
        self.assertEqual(self.client.get(self.url).json()["results"][0]["status"], "held")
        appeal = self.write("post", reverse("security-appeal", args=[case_id]), {"revision": 1, "request_key": str(uuid4()), "reason": "Это цитата"})
        self.assertEqual(appeal.status_code, 200)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.url).json()["results"], [])
        self.assertEqual(self.client.get(reverse("security-appeal", args=[case_id])).status_code, 404)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse("security-case", args=[case_id]), {"purpose": "Проверка"}).status_code, 403)
        self.other.user_permissions.add(Permission.objects.get(codename="review_security_case"))
        self.assertEqual(self.client.get(reverse("security-case", args=[case_id])).status_code, 400)
        self.assertEqual(self.client.get(reverse("security-case", args=[case_id]), {"purpose": "Рассмотрение обжалования"}).status_code, 200)
        released = self.write("post", reverse("security-case", args=[case_id]), {"revision": appeal.json()["revision"], "request_key": str(uuid4()), "decision": "release", "reason": "Подтверждена учебная цитата"})
        self.assertEqual(released.status_code, 200, released.content)
        self.client.force_login(self.owner)
        message = self.client.get(self.url).json()["results"][0]
        self.assertEqual(message["status"], "stored")
        self.assertGreater(message["sequence"], original_sequence)
        self.assertEqual(AuditEvent.objects.filter(operation="security.view").count(), 1)

    def test_csrf_and_sender_forgery_are_rejected(self):
        self.assertEqual(self.client.post(self.url, {"text": "Тест"}, format="json").status_code, 403)
        self.assertEqual(self.write("post", self.url, {"client_message_id": str(uuid4()), "text": "Тест", "sender_id": self.owner.pk}).status_code, 400)

    def test_cursor_pagination_and_distinct_orders_have_distinct_contexts(self):
        for index in range(52):
            self.write("post", self.url, {"client_message_id": str(uuid4()), "text": f"Сообщение {index}"})
        first = self.client.get(self.url).json()
        second = self.client.get(first["next"]).json()
        self.assertEqual(len(first["results"]), 50)
        self.assertEqual(len(second["results"]), 2)
        self.assertLess(first["results"][-1]["sequence"], second["results"][0]["sequence"])

    def test_preorder_discussion_is_stable_and_never_becomes_order_context(self):
        from accounts.test_workspace import approved_performer
        approved_performer(self.owner)
        self.buyer.is_customer = True
        self.buyer.save()
        service = self.order.service
        service.status = "published"
        service.save()
        payload = {"service_id": service.pk, "request_key": str(uuid4())}
        first = self.write("post", reverse("discussion"), payload)
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.json()["kind"], "discussion")
        self.assertIsNone(first.json()["order_id"])
        self.assertEqual(self.write("post", reverse("discussion"), payload).json()["id"], first.json()["id"])
        self.assertEqual(self.write("post", reverse("discussion"), {**payload, "request_key": str(uuid4())}).json()["id"], first.json()["id"])
        self.assertNotEqual(first.json()["id"], str(self.conversation.pk))
        url = reverse("messages", args=[first.json()["id"]])
        response = self.write("post", url, {"client_message_id": str(uuid4()), "text": "Вопрос до заказа"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.get(self.url).json()["results"], [])
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(url).json()["results"][0]["text"], "Вопрос до заказа")
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
