from django.urls import path

from .registration_views import AvatarView, CompleteRegistrationView, RegistrationView, SpecializationListView

app_name = "registration"
urlpatterns = [
    path("registration/", RegistrationView.as_view(), name="detail"),
    path("registration/complete/", CompleteRegistrationView.as_view(), name="complete"),
    path("registration/avatar/", AvatarView.as_view(), name="avatar"),
    path("specializations/", SpecializationListView.as_view(), name="specializations"),
]
