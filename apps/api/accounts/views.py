import hmac
import secrets
import time

from authlib.integrations.base_client.errors import OAuthError
from django.conf import settings
from django.contrib.auth import login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from joserfc.errors import JoseError
from requests.exceptions import RequestException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import MiniAppLoginSerializer, UserSerializer
from .services import AccountUnavailable, resolve_user
from .telegram import (InvalidTelegramData, TelegramNotConfigured,
                       identity_from_oidc, oidc_client, validate_mini_app)

OIDC_PENDING = "telegram_oidc_pending"


def csrf_failure(request, reason=""):
    return JsonResponse({"detail": "Обновите CSRF-токен и повторите запрос.", "code": "csrf_failed"}, status=403)


@method_decorator(never_cache, name="dispatch")
class PublicAuthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]


class CsrfView(PublicAuthView):
    def get(self, request):
        return Response({"csrf_token": get_token(request)})


class AuthOptionsView(PublicAuthView):
    def get(self, request):
        try:
            oidc_client()
            website = True
        except TelegramNotConfigured:
            website = False
        return Response({
            "telegram_mini_app": bool(settings.TELEGRAM_BOT_TOKEN),
            "telegram_website": website,
        })


def complete_login(request, identity):
    user = resolve_user(identity)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Response({"user": UserSerializer(user).data})


def unavailable():
    return Response({"detail": "Вход через Telegram ещё не настроен.", "code": "telegram_not_configured"}, status=503)


@method_decorator(csrf_protect, name="dispatch")
class MiniAppLoginView(PublicAuthView):
    def post(self, request):
        serializer = MiniAppLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return complete_login(request, validate_mini_app(serializer.validated_data["init_data"]))
        except TelegramNotConfigured:
            return unavailable()
        except InvalidTelegramData:
            return Response({"detail": "Не удалось подтвердить вход Telegram.", "code": "invalid_telegram_data"}, status=401)
        except AccountUnavailable:
            return Response({"detail": "Вход в аккаунт недоступен.", "code": "account_unavailable"}, status=403)


class OidcStartView(PublicAuthView):
    def get(self, request):
        try:
            client = oidc_client()
        except TelegramNotConfigured:
            return unavailable()
        # Одна незавершённая попытка на браузер: старые state не накапливаются.
        for key in list(request.session.keys()):
            if key.startswith("_state_telegram_"):
                del request.session[key]
        state = secrets.token_urlsafe(32)
        response = client.authorize_redirect(request, settings.TELEGRAM_OIDC_REDIRECT_URI,
                                             state=state, nonce=secrets.token_urlsafe(32))
        request.session[OIDC_PENDING] = {"state": state, "created_at": time.time()}
        return response


class OidcCallbackView(PublicAuthView):
    def get(self, request):
        state = request.query_params.get("state", "")
        pending = request.session.get(OIDC_PENDING)
        if not pending or not state or not hmac.compare_digest(state.encode(), pending["state"].encode()):
            return Response({"detail": "Недействительная попытка входа.", "code": "invalid_oidc_state"}, status=400)
        request.session.pop(OIDC_PENDING, None)
        age = time.time() - pending["created_at"]
        if age < 0 or age > settings.TELEGRAM_OIDC_STATE_MAX_AGE:
            request.session.pop(f"_state_telegram_{state}", None)
            return Response({"detail": "Начните вход заново.", "code": "expired_oidc_state"}, status=400)
        try:
            token = oidc_client().authorize_access_token(request, leeway=settings.TELEGRAM_AUTH_CLOCK_SKEW)
            return complete_login(request, identity_from_oidc(token.get("userinfo")))
        except TelegramNotConfigured:
            return unavailable()
        except (OAuthError, JoseError, InvalidTelegramData, ValueError, KeyError):
            return Response({"detail": "Не удалось подтвердить вход Telegram.", "code": "invalid_oidc_response"}, status=401)
        except RequestException:
            return Response({"detail": "Telegram временно недоступен. Повторите вход.", "code": "telegram_unavailable"}, status=503)
        except AccountUnavailable:
            return Response({"detail": "Вход в аккаунт недоступен.", "code": "account_unavailable"}, status=403)


@method_decorator(never_cache, name="dispatch")
class MeView(APIView):
    def get(self, request):
        return Response({"user": UserSerializer(request.user).data})


@method_decorator(never_cache, name="dispatch")
@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=204)
