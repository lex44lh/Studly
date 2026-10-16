from django.http import FileResponse, Http404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .avatars import delete_avatar, save_avatar
from .models import Specialization
from .registration import complete_registration, registration_data, registration_user, save_registration
from .registration_serializers import AvatarUpload, EmptyAction, RegistrationPatch, SpecializationSerializer


@method_decorator(never_cache, name="dispatch")
class PrivateRegistrationView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]


class RegistrationView(PrivateRegistrationView):
    def get(self, request):
        return Response(registration_data(registration_user(request.user.pk)))

    def patch(self, request):
        serializer = RegistrationPatch(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(save_registration(request.user.pk, serializer.validated_data))


class CompleteRegistrationView(PrivateRegistrationView):
    def post(self, request):
        serializer = EmptyAction(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(complete_registration(request.user.pk))


class AvatarView(PrivateRegistrationView):
    parser_classes = [MultiPartParser]

    def get(self, request):
        user = registration_user(request.user.pk)
        if not user.avatar:
            raise Http404
        try:
            response = FileResponse(user.avatar.open("rb"), content_type="image/png", filename="avatar.png")
        except FileNotFoundError as exc:
            raise Http404 from exc
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def post(self, request):
        serializer = AvatarUpload(data=request.data)
        serializer.is_valid(raise_exception=True)
        # QueryDict допускает повтор одного ключа: принимается ровно один файл.
        if len(request.FILES.getlist("avatar")) != 1:
            raise ValidationError({"avatar": "Передайте ровно один файл."})
        save_avatar(request.user.pk, serializer.validated_data["avatar"])
        return Response(registration_data(registration_user(request.user.pk)))

    def delete(self, request):
        delete_avatar(request.user.pk)
        return Response(status=204)


class SpecializationPagination(PageNumberPagination):
    page_size = 100


class SpecializationListView(ListAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = SpecializationSerializer
    pagination_class = SpecializationPagination

    def get_queryset(self):
        # Поиск одной подстрокой, включая кириллицу; без разбора на AND-слова.
        return Specialization.objects.filter(title__icontains=self.request.query_params.get("search", "").strip())
