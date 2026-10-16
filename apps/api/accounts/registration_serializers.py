"""JSON регистрации отделён от стабильного краткого ответа авторизации."""

from collections.abc import Mapping

from rest_framework import serializers

from .models import RegistrationProgress, Specialization


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            unexpected = set(data) - set(self.fields)
            if unexpected:
                raise serializers.ValidationError({
                    name: "Поле нельзя передавать в этом запросе."
                    for name in sorted(unexpected)
                })
        return super().to_internal_value(data)


class GeneralProfilePatch(StrictSerializer):
    # Черновик может быть неполным; обязательность проверяется при завершении.
    display_name = serializers.CharField(max_length=255, allow_blank=True, required=False)
    university = serializers.CharField(max_length=255, allow_blank=True, required=False)
    city = serializers.CharField(max_length=255, allow_blank=True, required=False)
    about = serializers.CharField(max_length=10000, allow_blank=True, required=False)


class PerformerProfilePatch(StrictSerializer):
    description = serializers.CharField(max_length=10000, allow_blank=True, required=False)
    study_year = serializers.CharField(max_length=100, allow_blank=True, required=False)
    portfolio = serializers.CharField(max_length=10000, allow_blank=True, required=False)
    specialization_ids = serializers.ListField(child=serializers.UUIDField(), required=False)

    def validate_specialization_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Повторяющиеся специализации не допускаются.")
        if Specialization.objects.filter(pk__in=ids).count() != len(ids):
            raise serializers.ValidationError("Одна или несколько специализаций не найдены.")
        return ids


class ProgressPatch(StrictSerializer):
    current_step = serializers.ChoiceField(choices=RegistrationProgress.Step.values, required=False)
    performer_skipped = serializers.BooleanField(required=False)


class RegistrationPatch(StrictSerializer):
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=["customer", "performer"]), required=False,
    )
    profile = GeneralProfilePatch(required=False)
    performer = PerformerProfilePatch(required=False)
    progress = ProgressPatch(required=False)

    def validate_roles(self, roles):
        if len(roles) != len(set(roles)):
            raise serializers.ValidationError("Повторяющиеся роли не допускаются.")
        return roles

    def validate(self, data):
        if not data or not any(not isinstance(value, dict) or value for value in data.values()):
            raise serializers.ValidationError("Передайте хотя бы одно поле для сохранения.")
        return data


class EmptyAction(StrictSerializer):
    pass


class AvatarUpload(StrictSerializer):
    avatar = serializers.FileField(max_length=255, allow_empty_file=False)

    def validate_avatar(self, avatar):
        from .avatars import normalize_avatar
        return normalize_avatar(avatar)


class SpecializationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialization
        fields = ["id", "title"]
