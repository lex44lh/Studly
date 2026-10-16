from rest_framework import serializers

from .models import User


class MiniAppLoginSerializer(serializers.Serializer):
    init_data = serializers.CharField(max_length=16384, trim_whitespace=False)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "display_name", "telegram_username"]
