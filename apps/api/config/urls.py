"""HTTP-маршруты Backend."""

from django.contrib import admin
from django.urls import include, path

from health.views import HealthView, ReadinessView
from accounts.cabinet_views import AccountView, CabinetView
from catalog.favorites import FavoriteListView, FavoriteView
from accounts.portfolio_views import (PortfolioView, PortfolioDetailView, PortfolioContentView,
                                      ModerationView, ModeratorProfileDecisionView)
from catalog.workspace import (OwnServicesV2View, OwnServiceV2View, ServiceSubmitView, ServiceDecisionView,
                               ServiceListV2View, ServiceDetailV2View)
from orders.workspace import (QuoteView, QuoteDetailView, OrdersV2View, OrderV2View, OrderActionV2View, OrderEventsView)
from conversations.views import (ConversationsView, ConversationView, DiscussionView, OrderConversationView, MessagesView, AppealView, SecurityCaseView)
from operations.staff_views import StaffResourcesView, StaffSessionView
from .views import ApiRootView

urlpatterns = [
    path("api/v1/", ApiRootView.as_view(), name="api-root"),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/ready/", ReadinessView.as_view(), name="ready"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/account/", AccountView.as_view(), name="account"),
    path("api/v1/cabinet/", CabinetView.as_view(), name="cabinet"),
    path("api/v1/favorites/", FavoriteListView.as_view(), name="favorite-list"),
    path("api/v1/favorites/<int:pk>/", FavoriteView.as_view(), name="favorite-detail"),
    path("api/v1/portfolio/", PortfolioView.as_view(), name="portfolio"),
    path("api/v1/portfolio/<uuid:pk>/", PortfolioDetailView.as_view(), name="portfolio-detail"),
    path("api/v1/portfolio/<uuid:pk>/content/", PortfolioContentView.as_view(), name="portfolio-content"),
    path("api/v1/performer/moderation/", ModerationView.as_view(), name="performer-moderation"),
    path("api/v1/staff/performers/<int:pk>/decision/", ModeratorProfileDecisionView.as_view(), name="performer-decision"),
    path("api/v2/services/", ServiceListV2View.as_view(), name="services-v2"),
    path("api/v2/services/<int:pk>/", ServiceDetailV2View.as_view(), name="service-v2"),
    path("api/v2/my/services/", OwnServicesV2View.as_view(), name="own-services-v2"),
    path("api/v2/my/services/<int:pk>/", OwnServiceV2View.as_view(), name="own-service-v2"),
    path("api/v2/my/services/<int:pk>/submit/", ServiceSubmitView.as_view(), name="service-submit"),
    path("api/v1/staff/services/<int:pk>/decision/", ServiceDecisionView.as_view(), name="service-decision"),
    path("api/v2/quotes/", QuoteView.as_view(), name="quotes-v2"),
    path("api/v2/quotes/<uuid:pk>/", QuoteDetailView.as_view(), name="quote-v2"),
    path("api/v2/orders/", OrdersV2View.as_view(), name="orders-v2"),
    path("api/v2/orders/<int:pk>/", OrderV2View.as_view(), name="order-v2"),
    path("api/v2/orders/<int:pk>/<str:action>/", OrderActionV2View.as_view(), name="order-action-v2"),
    path("api/v1/orders/<int:pk>/events/", OrderEventsView.as_view(), name="order-events"),
    path("api/v1/orders/<int:pk>/conversation/", OrderConversationView.as_view(), name="order-conversation"),
    path("api/v1/conversations/", ConversationsView.as_view(), name="conversations"),
    path("api/v1/discussions/", DiscussionView.as_view(), name="discussion"),
    path("api/v1/conversations/<uuid:pk>/", ConversationView.as_view(), name="conversation"),
    path("api/v1/conversations/<uuid:pk>/messages/", MessagesView.as_view(), name="messages"),
    path("api/v1/security-cases/<int:pk>/appeal/", AppealView.as_view(), name="security-appeal"),
    path("api/v1/staff/security-cases/<int:pk>/", SecurityCaseView.as_view(), name="security-case"),
    path("api/v1/staff/me/", StaffSessionView.as_view(), name="staff-session"),
    path("api/v1/staff/<str:resource>/", StaffResourcesView.as_view(), name="staff-resource-list"),
    path("api/v1/staff/<str:resource>/<int:pk>/", StaffResourcesView.as_view(), name="staff-resource-detail"),
    path("api/v1/", include("accounts.registration_urls")),
    path("api/v1/", include("catalog.urls")),
    path("api/v1/", include("orders.urls")),
]
