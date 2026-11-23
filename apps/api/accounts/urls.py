from django.urls import path

from .views import AuthOptionsView, CsrfView, LogoutView, MeView, MiniAppLoginView, OidcCallbackView, OidcStartView

from .email_views import (RegisterView, VerifyView, LoginView, ResetRequestView, ResetConfirmView, LinkView)

app_name = "accounts"
urlpatterns = [
    path("email/register/", RegisterView.as_view(), name="email-register"),
    path("email/verify/", VerifyView.as_view(), name="email-verify"),
    path("email/login/", LoginView.as_view(), name="email-login"),
    path("email/reset/request/", ResetRequestView.as_view(), name="email-reset-request"),
    path("email/reset/confirm/", ResetConfirmView.as_view(), name="email-reset-confirm"),
    path("email/link/", LinkView.as_view(), name="email-link"),
    path("options/", AuthOptionsView.as_view(), name="options"),
    path("csrf/", CsrfView.as_view(), name="csrf"),
    path("telegram/mini-app/", MiniAppLoginView.as_view(), name="mini-app"),
    path("telegram/start/", OidcStartView.as_view(), name="oidc-start"),
    path("telegram/callback/", OidcCallbackView.as_view(), name="oidc-callback"),
    path("me/", MeView.as_view(), name="me"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
