"""CSRF-protected JSON endpoints, including anonymous email entry points."""
from django.conf import settings
from django.contrib.auth import login, logout
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import email_auth
from .models import EmailChallenge
from .registration_serializers import StrictSerializer
from .serializers import UserSerializer


class EmailInput(StrictSerializer):
    email = serializers.CharField(max_length=254)

    def validate_email(self, value):
        try:
            return email_auth.canonical_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from None


class ProofInput(StrictSerializer):
    token = serializers.CharField(max_length=200, trim_whitespace=False)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


class VerifyInput(ProofInput):
    username = serializers.CharField(max_length=32)

    def validate_username(self, value):
        try:
            return email_auth.canonical_username(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from None


class LoginInput(StrictSerializer):
    identifier = serializers.CharField(max_length=254)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


@method_decorator(never_cache, name="dispatch")
@method_decorator(csrf_protect, name="dispatch")
@method_decorator(sensitive_post_parameters(), name="dispatch")
class EmailView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    @sensitive_variables()
    def post(self, request):
        # JSON is outside request.POST; redact it in Django technical error reports.
        request._request.sensitive_post_parameters = "__ALL__"
        if not getattr(settings, "STUDLY_EMAIL_AUTH_ENABLED", False):
            return Response({"code": "email_auth_unavailable", "detail": "Вход по почте временно недоступен."}, status=503)
        try:
            return self.execute(request)
        except email_auth.EmailError as exc:
            response = Response({"code": exc.code, "detail": exc.detail}, status=exc.status)
            if exc.retry_after:
                response["Retry-After"] = str(exc.retry_after)
            return response
        except DjangoValidationError as exc:
            return Response({"code": "invalid_password", "detail": exc.messages}, status=400)


def establish_session(request, user):
    logout(request)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Response({"user": UserSerializer(user).data})


class RegisterView(EmailView):
    def execute(self, request):
        serializer = EmailInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_auth.issue(request, serializer.validated_data["email"], EmailChallenge.Purpose.REGISTER)
        return Response({"detail": email_auth.NEUTRAL_DETAIL}, status=202)


class LinkView(EmailView):
    def execute(self, request):
        if not request.user.is_authenticated:
            return Response({"code": "telegram_reauthentication_required", "detail": "Повторите вход через Telegram для привязки почты."}, status=403)
        serializer = EmailInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_auth.issue(request, serializer.validated_data["email"], EmailChallenge.Purpose.LINK)
        return Response({"detail": email_auth.NEUTRAL_DETAIL}, status=202)


class VerifyView(EmailView):
    @sensitive_variables()
    def execute(self, request):
        serializer = VerifyInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = email_auth.verify(request, **serializer.validated_data)
        return establish_session(request, user)


class LoginView(EmailView):
    @sensitive_variables()
    def execute(self, request):
        serializer = LoginInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = email_auth.login_user(request, **serializer.validated_data)
        return establish_session(request, user)


class ResetRequestView(EmailView):
    def execute(self, request):
        serializer = EmailInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_auth.issue(request, serializer.validated_data["email"], EmailChallenge.Purpose.RESET)
        return Response({"detail": email_auth.NEUTRAL_DETAIL}, status=202)


class ResetConfirmView(EmailView):
    @sensitive_variables()
    def execute(self, request):
        serializer = ProofInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_auth.reset_password(request, **serializer.validated_data)
        logout(request)
        return Response(status=204)
