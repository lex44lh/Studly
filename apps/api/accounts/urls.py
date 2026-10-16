from django.urls import path

from .views import AuthOptionsView, CsrfView, LogoutView, MeView, MiniAppLoginView, OidcCallbackView, OidcStartView

app_name = "accounts"
urlpatterns = [
    path("options/", AuthOptionsView.as_view(), name="options"),
    path("csrf/", CsrfView.as_view(), name="csrf"),
    path("telegram/mini-app/", MiniAppLoginView.as_view(), name="mini-app"),
    path("telegram/start/", OidcStartView.as_view(), name="oidc-start"),
    path("telegram/callback/", OidcCallbackView.as_view(), name="oidc-callback"),
    path("me/", MeView.as_view(), name="me"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
