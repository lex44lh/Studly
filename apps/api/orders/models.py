from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_ACCEPTANCE = "pending_acceptance", "Ожидает согласия исполнителя"
        AWAITING_PAYMENT = "awaiting_payment", "Ожидает оплаты"
        CANCELLED = "cancelled", "Отменён заказчиком"
        DECLINED = "declined", "Исполнитель отказался"

    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="buyer_orders"
    )
    performer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="performer_orders"
    )
    service = models.ForeignKey(
        "catalog.Service", on_delete=models.PROTECT, related_name="orders"
    )
    service_revision = models.PositiveBigIntegerField(validators=[MinValueValidator(1)])
    request_key = models.UUIDField()
    revision = models.PositiveBigIntegerField(default=1)
    quote = models.OneToOneField("Quote", on_delete=models.PROTECT, null=True, blank=True)
    tariff_code = models.CharField(max_length=80, default="buyer-3-v1")
    base_price_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    selected_extras = models.JSONField(default=list)

    # Условия заказа сохраняются отдельно от изменяемого объявления.
    title = models.CharField(max_length=200)
    description = models.TextField()
    included = models.JSONField(default=list)
    duration_days = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    price_amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3)
    buyer_fee_percent = models.DecimalField(max_digits=5, decimal_places=2)
    buyer_fee_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=11, decimal_places=2)

    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.PENDING_ACCEPTANCE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="closed_orders", null=True, blank=True,
    )

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["buyer", "request_key"], name="order_buyer_request_key_unique"
            ),
            models.CheckConstraint(
                condition=~models.Q(buyer=models.F("performer")),
                name="order_different_participants",
            ),
            models.CheckConstraint(
                condition=models.Q(price_amount__gt=0), name="order_price_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(currency="RUB"), name="order_currency_rub"
            ),
            models.CheckConstraint(
                condition=models.Q(buyer_fee_percent__gte=0, buyer_fee_percent__lte=100),
                name="order_buyer_fee_percent_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(buyer_fee_amount__gte=0),
                name="order_buyer_fee_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount=models.F("price_amount") + models.F("buyer_fee_amount")),
                name="order_total_matches_components",
            ),
            models.CheckConstraint(
                condition=models.Q(service_revision__gte=1, duration_days__gte=1),
                name="order_revision_duration_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status="pending_acceptance", accepted_at__isnull=True,
                        closed_at__isnull=True, closed_by__isnull=True,
                    )
                    | models.Q(
                        status="awaiting_payment", accepted_at__isnull=False,
                        closed_at__isnull=True, closed_by__isnull=True,
                    )
                    | models.Q(
                        status="cancelled", closed_at__isnull=False,
                        closed_by__isnull=False, closed_by=models.F("buyer"),
                    )
                    | models.Q(
                        status="declined", accepted_at__isnull=True,
                        closed_at__isnull=False, closed_by__isnull=False,
                        closed_by=models.F("performer"),
                    )
                ),
                name="order_status_history_consistent",
            ),
        ]

    def __str__(self):
        return f"Заказ {self.pk}: {self.title}"


class Tariff(models.Model):
    code = models.CharField(max_length=80, primary_key=True)
    buyer_fee_percent = models.DecimalField(max_digits=5, decimal_places=2)

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        previous = type(self).objects.filter(pk=self.pk).first()
        if previous and previous.buyer_fee_percent != self.buyer_fee_percent:
            raise ValidationError("Создайте новую версию тарифа вместо изменения существующей.")
        return super().save(*args, **kwargs)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(buyer_fee_percent__gte=0, buyer_fee_percent__lte=100), name="tariff_percent_valid")]


class Quote(models.Model):
    import uuid
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT)
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class OrderEvent(models.Model):
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=80)
    revision = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
