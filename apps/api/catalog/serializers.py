from collections.abc import Mapping

from rest_framework import serializers

from accounts.models import User
from .models import Service


class PerformerSummarySerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name")

    class Meta:
        model = User
        fields = ["id", "name"]


class PerformerSerializer(PerformerSummarySerializer):
    class Meta(PerformerSummarySerializer.Meta):
        fields = ["id", "name", "about"]


class ServiceSerializer(serializers.ModelSerializer):
    performer = PerformerSummarySerializer(read_only=True)
    included = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = Service
        fields = [
            "id", "title", "description", "price_amount", "currency",
            "duration_days", "performer", "included", "is_demo",
        ]


class ServiceQuoteSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(read_only=True)
    service_revision = serializers.IntegerField(read_only=True)
    price_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    currency = serializers.CharField(read_only=True)
    is_demo = serializers.BooleanField(read_only=True)
    buyer_fee_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    buyer_fee_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    # После надбавки итог может превышать максимальную цену поля услуги.
    total_amount = serializers.DecimalField(max_digits=11, decimal_places=2, read_only=True)


class OwnServiceSerializer(ServiceSerializer):
    included = serializers.ListField(
        child=serializers.CharField(max_length=500), max_length=50,
        required=False, default=list,
    )
    # В существующем каталоге используется RUB; другие валюты не согласованы.
    currency = serializers.ChoiceField(choices=["RUB"], default="RUB")

    class Meta(ServiceSerializer.Meta):
        fields = [*ServiceSerializer.Meta.fields, "status"]
        read_only_fields = ["id", "performer", "is_demo", "status"]

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            writable = {name for name, field in self.fields.items() if not field.read_only}
            unexpected = set(data) - writable
            if unexpected:
                raise serializers.ValidationError({
                    name: "Поле нельзя передавать при создании или изменении услуги."
                    for name in sorted(unexpected)
                })
        return super().to_internal_value(data)

    def validate(self, attrs):
        if self.instance is not None and not attrs:
            raise serializers.ValidationError("Укажите хотя бы одно поле услуги для сохранения.")
        return attrs
