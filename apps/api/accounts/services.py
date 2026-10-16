"""Сопоставление подтверждённого Telegram-аккаунта с пользователем STUDLY."""

from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction

from .models import User


class AccountUnavailable(Exception):
    pass


def resolve_user(identity):
    try:
        with transaction.atomic():
            user, _ = User.objects.select_for_update().get_or_create(
                telegram_id=identity.telegram_id,
                defaults={"password": make_password(None)},
            )
            if not user.is_active:
                raise AccountUnavailable
            if identity.oidc_subject:
                if user.telegram_oidc_subject not in (None, identity.oidc_subject):
                    raise AccountUnavailable
                user.telegram_oidc_subject = identity.oidc_subject
            if not user.display_name_customized:
                user.display_name = identity.display_name
            user.telegram_username = identity.username
            user.save(update_fields=["display_name", "telegram_username", "telegram_oidc_subject"])
            return user
    except IntegrityError as exc:
        # В том числе конфликт уникального sub: транзакция не оставит новый аккаунт.
        raise AccountUnavailable from exc
