"""Сохранённые поля служат черновиком: дублирующей JSON-копии профиля нет."""

from django.db import transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import PerformerProfile, RegistrationProgress, User
from .registration_serializers import SpecializationSerializer


def registration_user(user_id):
    return User.objects.select_related("performer_profile", "registration_progress").prefetch_related(
        "performer_profile__specializations",
    ).get(pk=user_id)


def registration_data(user):
    progress = getattr(user, "registration_progress", None)
    performer = getattr(user, "performer_profile", None)
    specializations = list(performer.specializations.all()) if performer else []
    roles = [role for role, selected in (("customer", user.is_customer), ("performer", user.is_performer))
             if selected]
    missing = []
    if not user.display_name.strip():
        missing.append("profile.display_name")
    if not roles:
        missing.append("roles")
    completed_at = progress.completed_at if progress else None
    performer_missing = []
    if not user.is_performer:
        performer_missing.append("roles.performer")
    if not user.display_name.strip():
        performer_missing.append("profile.display_name")
    if not specializations:
        performer_missing.append("performer.specialization_ids")
    return {
        "roles": roles,
        "profile": {
            "display_name": user.display_name,
            "avatar_url": reverse("registration:avatar") if user.avatar else None,
            "university": user.university, "city": user.city, "about": user.about,
        },
        "performer": {
            "description": performer.description, "study_year": performer.study_year,
            "portfolio": performer.portfolio,
            "specializations": SpecializationSerializer(specializations, many=True).data,
        } if performer else None,
        "progress": {
            "current_step": progress.current_step if progress else RegistrationProgress.Step.ROLES,
            "performer_skipped": progress.performer_skipped if progress else False,
            "updated_at": progress.updated_at.isoformat() if progress else None,
        },
        "status": {
            "is_complete": bool(completed_at and not missing),
            "completed_at": completed_at.isoformat() if completed_at else None,
            "missing_fields": missing,
            "performer_ready": not performer_missing,
            "performer_missing_fields": performer_missing,
        },
    }


@transaction.atomic
def save_registration(user_id, data):
    # Этот же замок используют завершение, загрузка аватара и Telegram-вход.
    user = User.objects.select_for_update().get(pk=user_id)
    fields = []
    if "roles" in data:
        user.is_customer = "customer" in data["roles"]
        user.is_performer = "performer" in data["roles"]
        fields.extend(["is_customer", "is_performer"])
    for field, value in data.get("profile", {}).items():
        setattr(user, field, value)
        fields.append(field)
        if field == "display_name":
            user.display_name_customized = True
            fields.append("display_name_customized")
    if fields:
        user.save(update_fields=fields)
    if "performer" in data:
        performer, _ = PerformerProfile.objects.get_or_create(user=user)
        values = data["performer"].copy()
        ids = values.pop("specialization_ids", None)
        for field, value in values.items():
            setattr(performer, field, value)
        if values:
            performer.save(update_fields=list(values))
        if ids is not None:
            performer.specializations.set(ids)
    progress, _ = RegistrationProgress.objects.get_or_create(user=user)
    for field, value in data.get("progress", {}).items():
        setattr(progress, field, value)
    # Неполный черновик после завершения снова требует явного завершения.
    if not user.display_name.strip() or not (user.is_customer or user.is_performer):
        progress.completed_at = None
    progress.save()
    return registration_data(registration_user(user_id))


@transaction.atomic
def complete_registration(user_id):
    user = User.objects.select_for_update().get(pk=user_id)
    missing = registration_data(user)["status"]["missing_fields"]
    if missing:
        raise ValidationError({"code": "registration_incomplete", "missing_fields": missing})
    progress, _ = RegistrationProgress.objects.get_or_create(user=user)
    if progress.completed_at is None:
        progress.completed_at = timezone.now()
        progress.save()
    return registration_data(registration_user(user_id))
