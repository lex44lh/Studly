from django.urls import path

from .views import (OwnServiceDetailView, OwnServiceListView, PerformerDetailView,
                    ServiceDetailView, ServiceListView, ServiceQuoteView)

app_name = "catalog"
urlpatterns = [
    path("services/", ServiceListView.as_view(), name="list"),
    path("services/<int:pk>/", ServiceDetailView.as_view(), name="detail"),
    path("services/<int:pk>/quote/", ServiceQuoteView.as_view(), name="quote"),
    path("performers/<int:pk>/", PerformerDetailView.as_view(), name="performer"),
    path("my/services/", OwnServiceListView.as_view(), name="own-list"),
    path("my/services/<int:pk>/", OwnServiceDetailView.as_view(), name="own-detail"),
]
