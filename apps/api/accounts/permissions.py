"""Роли аккаунта не заменяют принадлежность объекта и служебные permissions."""

from rest_framework.exceptions import PermissionDenied


def require_role(user, role):
    if not user.is_authenticated or not user.is_active or not getattr(user, f"is_{role}", False):
        raise PermissionDenied(f"Для нового действия требуется роль {role}.")


def account_capabilities(user):
    return {
        "customer": bool(user.is_customer),
        "performer": bool(user.is_performer),
        "create_order": bool(user.is_customer),
        "create_service": bool(user.is_performer),
        "django_admin": bool(user.is_staff),
        "moderate_services": bool(user.is_staff and user.has_perm("catalog.moderate_service")),
        "moderate_performers": bool(user.is_staff and user.has_perm("accounts.moderate_performer")),
    }
