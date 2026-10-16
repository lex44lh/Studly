"""Один аккаунт STUDLY для обоих способов входа через Telegram."""

import uuid

from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, telegram_id, password=None, **extra_fields):
        if type(telegram_id) is not int or not 0 < telegram_id <= 2**63 - 1:
            raise ValueError("Требуется положительный 64-битный Telegram ID.")
        user = self.model(telegram_id=telegram_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, telegram_id, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields["is_staff"] is not True or extra_fields["is_superuser"] is not True:
            raise ValueError("Суперпользователю нужны служебные права Django.")
        return self.create_user(telegram_id, password, **extra_fields)


class User(AbstractUser):
    username = None
    # Пустое значение используется для демонстрационных профилей без входа.
    # Реальный вход всё равно требует проверенный положительный Telegram ID.
    telegram_id = models.PositiveBigIntegerField(unique=True, null=True, blank=True)
    # Издатель OIDC фиксирован в accounts/telegram.py; sub не является Telegram ID.
    telegram_oidc_subject = models.CharField(max_length=255, unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=64, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    display_name_customized = models.BooleanField(default=False)
    about = models.TextField(blank=True)
    university = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=255, blank=True)
    is_customer = models.BooleanField(default=False)
    is_performer = models.BooleanField(default=False)
    # Публичная раздача MEDIA_ROOT не включается: чтение через закрытый API.
    avatar = models.FileField(upload_to="avatars/", max_length=255, blank=True)

    USERNAME_FIELD = "telegram_id"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(telegram_id__gt=0), name="user_telegram_id_positive")
        ]

    def __str__(self):
        return self.display_name or str(self.telegram_id)


class Specialization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, unique=True)

    class Meta:
        ordering = ["title", "id"]

    def __str__(self):
        return self.title


class PerformerProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="performer_profile")
    description = models.TextField(blank=True)
    study_year = models.CharField(max_length=100, blank=True)
    portfolio = models.TextField(blank=True)
    specializations = models.ManyToManyField(Specialization, blank=True)


class RegistrationProgress(models.Model):
    class Step(models.TextChoices):
        ROLES = "roles", "Роли"
        PROFILE = "profile", "Общий профиль"
        PERFORMER = "performer", "Профиль исполнителя"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="registration_progress")
    current_step = models.CharField(max_length=16, choices=Step.choices, default=Step.ROLES)
    performer_skipped = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
