from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Service(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "На модерации"
        PUBLISHED = "published", "Опубликована"
        REJECTED = "rejected", "Отклонена"
        DRAFT = "draft", "Черновик"
        CHANGES = "changes", "Нужны исправления"

    performer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="services"
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    price_amount = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    currency = models.CharField(max_length=3, default="RUB")
    duration_days = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    included = models.JSONField(default=list)
    category = models.CharField(max_length=100, blank=True)
    extras = models.JSONField(default=list)
    portfolio_examples = models.ManyToManyField("accounts.PortfolioExample", blank=True)
    moderation_reason = models.TextField(blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    # Модератор подтверждает конкретную редакцию содержания.
    revision = models.PositiveBigIntegerField(default=1, editable=False)
    is_demo = models.BooleanField(default=False)
    # Идемпотентное заполнение без фиксации первичных ключей и Telegram ID.
    demo_key = models.CharField(max_length=64, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["id"]
        permissions = [("moderate_service", "Может одобрять и отклонять услуги")]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=["pending", "published", "rejected", "draft", "changes"]),
                name="service_status_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(price_amount__gte=0), name="service_price_nonnegative"
            ),
            models.CheckConstraint(
                condition=models.Q(duration_days__gte=1), name="service_duration_positive"
            ),
        ]

    def __str__(self):
        return self.title


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "service"], name="favorite_user_service_unique")]
