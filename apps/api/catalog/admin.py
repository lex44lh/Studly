"""Модерация через служебный интерфейс Backend, без изменения Frontend."""

from django.contrib import admin, messages
from django.core import signing
from django.db import transaction
from django.template.response import TemplateResponse

from .models import Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    moderation_salt = "catalog.service.moderation"
    list_display = ["id", "title", "performer", "status", "is_demo"]
    list_filter = ["status", "is_demo"]
    search_fields = ["title", "performer__display_name"]
    list_select_related = ["performer"]
    readonly_fields = [field.name for field in Service._meta.fields]
    actions = ["publish_services", "reject_services"]

    def has_moderate_permission(self, request):
        return request.user.has_perm("catalog.moderate_service")

    def has_view_permission(self, request, obj=None):
        return self.has_moderate_permission(request) or super().has_view_permission(request, obj)

    def has_module_permission(self, request):
        return self.has_view_permission(request)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description="Одобрить и опубликовать", permissions=["moderate"])
    def publish_services(self, request, queryset):
        return self._moderate(request, queryset, Service.Status.PUBLISHED, "publish_services")

    @admin.action(description="Отклонить", permissions=["moderate"])
    def reject_services(self, request, queryset):
        return self._moderate(request, queryset, Service.Status.REJECTED, "reject_services")

    def _moderate(self, request, queryset, status, action):
        if request.POST.get("confirm_moderation") != "yes":
            services = list(queryset.filter(status=Service.Status.PENDING, is_demo=False))
            if not services:
                self.message_user(request, "Нет услуг, ожидающих модерации.", messages.WARNING)
                return None
            token = signing.dumps({
                "moderator": request.user.pk,
                "status": status,
                "revisions": {str(service.pk): service.revision for service in services},
            }, salt=self.moderation_salt, compress=True)
            return TemplateResponse(request, "admin/catalog/service/moderate_confirmation.html", {
                **self.admin_site.each_context(request),
                "opts": self.model._meta,
                "title": "Подтвердите решение по показанным услугам",
                "services": services,
                "action": action,
                "decision": Service.Status(status).label,
                "review_token": token,
            })

        try:
            reviewed = signing.loads(request.POST.get("review_token", ""),
                                     salt=self.moderation_salt, max_age=1800)
        except signing.BadSignature:
            self.message_user(request, "Подтверждение недействительно или устарело. Просмотрите услуги заново.",
                              messages.ERROR)
            return None
        if reviewed["moderator"] != request.user.pk or reviewed["status"] != status:
            self.message_user(request, "Подтверждение выдано для другого модератора или решения.", messages.ERROR)
            return None

        revisions = reviewed["revisions"]
        changed = 0
        with transaction.atomic():
            services = list(queryset.select_for_update(of=("self",)).filter(
                pk__in=revisions, status=Service.Status.PENDING, is_demo=False,
            ))
            for service in services:
                if service.revision != revisions[str(service.pk)]:
                    continue
                service.status = status
                service.save(update_fields=["status"])
                self.log_change(request, service,
                                f"Модерация: {service.get_status_display()}; редакция {service.revision}")
                changed += 1
        if changed:
            self.message_user(request, f"Обработано услуг: {changed}.", messages.SUCCESS)
        if changed != len(revisions):
            self.message_user(request, "Часть услуг изменилась или уже обработана. Просмотрите их заново.",
                              messages.WARNING)
        return None
