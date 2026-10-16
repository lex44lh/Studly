from collections.abc import Mapping

from rest_framework import serializers

from catalog.serializers import PerformerSummarySerializer
from .models import Order


class StrictInputSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            unexpected = set(data) - set(self.fields)
            if unexpected:
                raise serializers.ValidationError({
                    name: "Поле нельзя передавать в этом запросе."
                    for name in sorted(unexpected)
                })
        return super().to_internal_value(data)


class CreateOrderSerializer(StrictInputSerializer):
    service_id = serializers.IntegerField(min_value=1, max_value=2**63 - 1)
    service_revision = serializers.IntegerField(min_value=1, max_value=2**63 - 1)
    request_key = serializers.UUIDField()


class OrderActionSerializer(StrictInputSerializer):
    pass


class OrderSerializer(serializers.ModelSerializer):
    buyer = PerformerSummarySerializer(read_only=True)
    performer = PerformerSummarySerializer(read_only=True)
    closed_by = PerformerSummarySerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "service_id", "service_revision", "request_key", "buyer", "performer",
            "title", "description", "included", "duration_days", "price_amount", "currency",
            "buyer_fee_percent", "buyer_fee_amount", "total_amount", "status",
            "created_at", "accepted_at", "closed_at", "closed_by",
        ]
        read_only_fields = fields
