from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from rest_framework.exceptions import APIException, ValidationError

from .models import Tariff


def price_snapshot(service, extra_ids):
    try:
        tariff = Tariff.objects.get(pk=settings.STUDLY_V2_BUYER_TARIFF)
    except Tariff.DoesNotExist as exc:
        error = APIException("Версия тарифа временно недоступна.")
        error.status_code = 503
        raise error from exc
    requested = {str(pk) for pk in extra_ids}
    selected = [x for x in service.extras if x["id"] in requested]
    if len(selected) != len(requested):
        raise ValidationError({"extra_ids": "Дополнение больше недоступно."})
    selected.sort(key=lambda x: x["id"])
    extras_amount = sum((Decimal(x["price_amount"]) for x in selected), Decimal("0.00"))
    subtotal = service.price_amount + extras_amount
    fee = (subtotal * tariff.buyer_fee_percent / Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    days = service.duration_days + sum(x["extra_days"] for x in selected)
    # Существующая модель заказа хранит subtotal в price_amount.
    if subtotal > Decimal("99999999.99") or fee > Decimal("99999999.99") or days > 32767:
        raise ValidationError("Итог превышает технические ограничения заказа.")
    return {"service_id": service.pk, "service_revision": service.revision,
            "title": service.title, "description": service.description, "included": service.included,
            "performer_id": service.performer_id, "currency": "RUB", "duration_days": days,
            "tariff_code": tariff.code, "base_price_amount": format(service.price_amount, ".2f"),
            "selected_extras": selected, "extras_amount": format(extras_amount, ".2f"),
            "price_amount": format(subtotal, ".2f"), "buyer_fee_percent": format(tariff.buyer_fee_percent, ".2f"),
            "buyer_fee_amount": format(fee, ".2f"), "total_amount": format(subtotal+fee, ".2f")}
