from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_ACCEPTANCE = "pending_acceptance", "Ожидает согласия исполнителя"
        AWAITING_PAYMENT = "awaiting_payment", "Ожидает оплаты"

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
                    models.Q(status="pending_acceptance", accepted_at__isnull=True)
                    | models.Q(status="awaiting_payment", accepted_at__isnull=False)
                ),
                name="order_status_acceptance_consistent",
            ),
        ]

    def __str__(self):
        return f"Заказ {self.pk}: {self.title}"
