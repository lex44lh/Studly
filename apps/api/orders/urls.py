from django.urls import path

from .views import OrderAcceptView, OrderDetailView, OrderListView


app_name = "orders"
urlpatterns = [
    path("orders/", OrderListView.as_view(), name="list"),
    path("orders/<int:pk>/", OrderDetailView.as_view(), name="detail"),
    path("orders/<int:pk>/accept/", OrderAcceptView.as_view(), name="accept"),
]
