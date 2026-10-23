from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from operations.services import Conflict, audit
from .models import PerformerProfile, User


def moderated_fields(user):
    profile = PerformerProfile.objects.filter(user=user).first()
    return (user.is_performer, user.display_name, user.about, user.university, user.city,
            profile.description if profile else "", profile.study_year if profile else "",
            profile.portfolio if profile else "",
            tuple(sorted(str(x) for x in profile.specializations.values_list("pk", flat=True))) if profile else ())


def touch_performer(user):
    """Вызывается при удерживаемой блокировке User во всех путях изменения."""
    profile = PerformerProfile.objects.filter(user=user).first()
    if profile is None:
        return
    profile.revision += 1
    if profile.moderation_status in ("approved", "pending"):
        profile.moderation_status = "pending"
        profile.moderation_reason = ""
        profile.submitted_at = timezone.now()
    profile.save(update_fields=["revision", "moderation_status", "moderation_reason", "submitted_at"])
    audit(user, "profile.changed", profile.pk, revision=profile.revision, status=profile.moderation_status)


def readiness(profile):
    missing = []
    if not profile.user.is_performer:
        missing.append("roles.performer")
    if not profile.user.display_name.strip():
        missing.append("profile.display_name")
    if not profile.description.strip():
        missing.append("performer.description")
    if not profile.examples.filter(active=True).exists():
        missing.append("portfolio")
    return missing


def profile_data(profile):
    missing = readiness(profile)
    return {"user_id": profile.user_id, "revision": profile.revision,
            "status": profile.moderation_status, "reason": profile.moderation_reason,
            "submitted_at": profile.submitted_at.isoformat() if profile.submitted_at else None,
            "ready_to_submit": not missing, "missing_fields": missing,
            "approved": profile.moderation_status == "approved" and not missing}


def locked_profile(user_id):
    from django.shortcuts import get_object_or_404
    user = get_object_or_404(User.objects.select_for_update(), pk=user_id)
    profile, _ = PerformerProfile.objects.get_or_create(user=user)
    return profile


def submit_profile(user, data):
    profile = locked_profile(user.pk)
    if profile.revision != data["revision"]:
        raise Conflict()
    if profile.moderation_status not in ("draft", "rejected", "changes"):
        raise Conflict("Профиль уже отправлен или рассмотрен.")
    missing = readiness(profile)
    if missing:
        raise ValidationError({"missing_fields": missing})
    profile.moderation_status = "pending"
    profile.moderation_reason = ""
    profile.submitted_at = timezone.now()
    profile.revision += 1
    profile.save()
    audit(user, "profile.submit", profile.pk, revision=profile.revision)
    return profile_data(profile)


def decide_profile(moderator, user_id, data):
    if not moderator.is_staff or not moderator.has_perm("accounts.moderate_performer"):
        raise PermissionDenied()
    if moderator.pk == user_id:
        raise PermissionDenied("Нельзя модерировать свой профиль.")
    profile = locked_profile(user_id)
    if profile.revision != data["revision"] or profile.moderation_status != "pending":
        raise Conflict()
    if data["decision"] == "approved" and readiness(profile):
        raise ValidationError({"missing_fields": readiness(profile)})
    profile.moderation_status = data["decision"]
    profile.moderation_reason = data.get("reason", "")
    profile.revision += 1
    profile.save()
    audit(moderator, "profile.decide", profile.pk, revision=profile.revision,
          decision=data["decision"], reason=profile.moderation_reason)
    return profile_data(profile)
