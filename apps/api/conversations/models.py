import uuid
from django.conf import settings
from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField("orders.Order", on_delete=models.PROTECT, related_name="conversation", null=True)
    discussion = models.OneToOneField("Discussion", on_delete=models.PROTECT, related_name="conversation", null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=(models.Q(order__isnull=False, discussion__isnull=True) |
                                                         models.Q(order__isnull=True, discussion__isnull=False)),
                                              name="conversation_exactly_one_context")]


class Discussion(models.Model):
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="service_discussions")
    performer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="incoming_discussions")
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT)
    title = models.CharField(max_length=200)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["buyer", "service"], name="discussion_buyer_service_unique"),
                       models.CheckConstraint(condition=~models.Q(buyer=models.F("performer")), name="discussion_different_participants")]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.PROTECT, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    client_message_id = models.UUIDField()
    text = models.TextField()
    status = models.CharField(max_length=16, choices=[("stored", "Сохранено"), ("held", "Удержано")])
    categories = models.JSONField(default=list)
    rules_version = models.CharField(max_length=80)
    sequence = models.OneToOneField("MessageSequence", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["conversation", "sender", "client_message_id"], name="message_sender_intent_unique"),
            models.CheckConstraint(condition=models.Q(status__in=["stored", "held"]), name="message_status_valid"),
        ]


class SecurityCase(models.Model):
    message = models.OneToOneField(Message, on_delete=models.PROTECT, related_name="security_case")
    appealed = models.BooleanField(default=False)
    appeal_reason = models.TextField(blank=True)
    decision = models.CharField(max_length=16, blank=True, choices=[("release", "Доставить"), ("keep", "Удержать")])
    decision_reason = models.TextField(blank=True)
    revision = models.PositiveBigIntegerField(default=1)

    class Meta:
        permissions = [("review_security_case", "Может рассматривать конкретные случаи безопасности сообщений")]


class MessageSequence(models.Model):
    """Новый номер видимости при release не теряется за курсором получателя."""
    pass
