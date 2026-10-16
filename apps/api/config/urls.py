"""HTTP-маршруты Backend."""

from django.contrib import admin
from django.urls import include, path

from health.views import HealthView, ReadinessView
from .views import ApiRootView

urlpatterns = [
    path("api/v1/", ApiRootView.as_view(), name="api-root"),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/ready/", ReadinessView.as_view(), name="ready"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("accounts.registration_urls")),
    path("api/v1/", include("catalog.urls")),
    path("api/v1/", include("orders.urls")),
]
