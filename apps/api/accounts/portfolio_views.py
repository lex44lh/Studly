from hashlib import sha256
from urllib.parse import urlsplit

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from operations.services import Conflict, audit, execute
from .models import PerformerProfile, PortfolioExample
from .moderation import decide_profile, locked_profile, profile_data, submit_profile, touch_performer
from .permissions import require_role
from .portfolio_files import normalize_example
from .registration_serializers import StrictSerializer
from .registration_views import PrivateRegistrationView


class VersionedAction(StrictSerializer):
    revision = serializers.IntegerField(min_value=1, max_value=2**63-1)
    request_key = serializers.UUIDField()


class ExampleInput(VersionedAction):
    title = serializers.CharField(max_length=200)
    url = serializers.URLField(max_length=2000, required=False)

    def validate_url(self, value):
        parsed = urlsplit(value)
        if parsed.scheme not in ("http", "https") or parsed.username or parsed.password:
            raise serializers.ValidationError("Нужна HTTP(S)-ссылка без учётных данных.")
        return value


class DecisionInput(VersionedAction):
    decision = serializers.ChoiceField(choices=["approved", "rejected", "changes"])
    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")

    def validate(self, data):
        if data["decision"] != "approved" and not data["reason"].strip():
            raise serializers.ValidationError({"reason": "Укажите причину."})
        return data


class ExampleEditInput(ExampleInput):
    title = serializers.CharField(max_length=200, required=False)

    def validate(self, data):
        if "title" not in data and "url" not in data:
            raise serializers.ValidationError("Укажите title или url.")
        return data


def example_data(example):
    return {"id": str(example.pk), "title": example.title,
            "kind": "file" if example.file else "link", "url": example.url or None,
            "content_url": f"/api/v1/portfolio/{example.pk}/content/" if example.file else None,
            "content_type": example.content_type or None, "size": example.size,
            "created_at": example.created_at.isoformat()}


class PortfolioView(PrivateRegistrationView):
    parser_classes = [JSONParser, MultiPartParser]

    def get(self, request):
        from catalog.views import CatalogPagination
        pager = CatalogPagination()
        examples = PortfolioExample.objects.filter(profile__user=request.user, active=True).order_by("created_at", "id")
        return pager.get_paginated_response([example_data(item) for item in pager.paginate_queryset(examples, request)])

    def post(self, request):
        require_role(request.user, "performer")
        if "file" in request.data and "file" not in request.FILES:
            raise ValidationError({"file": "Ожидается настоящий multipart-файл."})
        if hasattr(request.data, "getlist") and any(len(request.data.getlist(k)) != 1 for k in request.data if k != "file"):
            raise ValidationError("Повторяющиеся multipart-поля не принимаются.")
        if set(request.FILES) - {"file"} or len(request.FILES.getlist("file")) > 1:
            raise ValidationError({"file": "Передайте один поддерживаемый файл."})
        raw_data = {k: request.data[k] for k in request.data if k != "file"}
        serializer = ExampleInput(data=raw_data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        upload = request.FILES.get("file")
        if bool(upload) == bool(data.get("url")):
            raise ValidationError("Передайте либо URL, либо файл.")
        content, mime = normalize_example(upload) if upload else (None, "")
        signature_data = {**data, "file_sha256": sha256(content.read()).hexdigest() if content else None}
        if content:
            content.seek(0)
        saved = []

        def create():
            profile = locked_profile(request.user.pk)
            if profile.revision != data["revision"]:
                raise Conflict()
            example = PortfolioExample(profile=profile, title=data["title"], url=data.get("url", ""), content_type=mime)
            if content:
                example.file.save(content.name, content, save=False)
                saved.append(example.file.name)
                example.size = content.size
            example.save()
            touch_performer(profile.user)
            profile.refresh_from_db()
            return {"example": example_data(example), "moderation": profile_data(profile)}
        try:
            body, replayed = execute(actor=request.user, operation="portfolio.add", data=signature_data, callback=create)
        except Exception:
            storage = PortfolioExample._meta.get_field("file").storage
            for name in saved:
                storage.delete(name)
            raise
        return Response(body, status=200 if replayed else 201)


class PortfolioDetailView(PrivateRegistrationView):
    def patch(self, request, pk):
        require_role(request.user, "performer")
        serializer = ExampleEditInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "id": str(pk)}
        def edit():
            profile = locked_profile(request.user.pk)
            if profile.revision != data["revision"]:
                raise Conflict()
            example = get_object_or_404(PortfolioExample, pk=pk, profile=profile, active=True)
            if "url" in data and example.file:
                raise ValidationError({"url": "Для замены файла добавьте новую работу."})
            changed = any(key in data and getattr(example, key) != data[key] for key in ("title", "url"))
            for key in ("title", "url"):
                if key in data:
                    setattr(example, key, data[key])
            example.save()
            if changed:
                touch_performer(profile.user)
            profile.refresh_from_db()
            return {"example": example_data(example), "moderation": profile_data(profile)}
        body, _ = execute(actor=request.user, operation="portfolio.edit", data=data, callback=edit)
        return Response(body)

    def delete(self, request, pk):
        require_role(request.user, "performer")
        serializer = VersionedAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "id": str(pk)}
        def remove():
            profile = locked_profile(request.user.pk)
            if profile.revision != data["revision"]:
                raise Conflict()
            example = get_object_or_404(PortfolioExample, pk=pk, profile=profile, active=True)
            example.active = False
            example.save(update_fields=["active"])
            touch_performer(profile.user)
            profile.refresh_from_db()
            return {"moderation": profile_data(profile)}
        body, _ = execute(actor=request.user, operation="portfolio.remove", data=data, callback=remove)
        return Response(body)


class PortfolioContentView(PrivateRegistrationView):
    def get(self, request, pk):
        item = get_object_or_404(PortfolioExample.objects.select_related("profile"), pk=pk)
        if item.profile.user_id != request.user.pk and not (
            request.user.is_staff and request.user.has_perm("accounts.moderate_performer")
        ):
            raise Http404
        if not item.file:
            raise Http404
        try:
            response = FileResponse(item.file.open("rb"), as_attachment=True,
                                    filename="portfolio.pdf" if item.content_type == "application/pdf" else "portfolio.png",
                                    content_type=item.content_type)
        except FileNotFoundError as exc:
            raise Http404 from exc
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "sandbox; default-src 'none'"
        if item.profile.user_id != request.user.pk:
            audit(request.user, "portfolio.read", item.pk, profile_id=item.profile_id)
        return response


class ModerationView(PrivateRegistrationView):
    def get(self, request):
        profile = PerformerProfile.objects.select_related("user").filter(user=request.user).first()
        if profile is None:
            missing = ["performer.description", "portfolio"]
            if not request.user.is_performer:
                missing.append("roles.performer")
            if not request.user.display_name.strip():
                missing.append("profile.display_name")
            return Response({"user_id": request.user.pk, "revision": 1, "status": "draft", "reason": "",
                             "submitted_at": None, "approved": False,
                             "ready_to_submit": False, "missing_fields": missing})
        return Response(profile_data(profile))

    def post(self, request):
        require_role(request.user, "performer")
        serializer = VersionedAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        body, _ = execute(actor=request.user, operation="profile.submit", data=data,
                          callback=lambda: submit_profile(request.user, data))
        return Response(body)


class ModeratorProfileDecisionView(PrivateRegistrationView):
    def post(self, request, pk):
        if not request.user.is_staff or not request.user.has_perm("accounts.moderate_performer"):
            raise PermissionDenied()
        serializer = DecisionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "user_id": pk}
        body, _ = execute(actor=request.user, operation="profile.decide", data=data,
                          callback=lambda: decide_profile(request.user, pk, data))
        return Response(body)
