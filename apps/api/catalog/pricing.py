"""Предварительная стоимость для заказчика по текущей цене услуги."""

from decimal import Decimal, ROUND_HALF_UP


BUYER_FEE_PERCENT = Decimal("3.00")
KOPECK = Decimal("0.01")


def calculate_buyer_quote(service):
    price = service.price_amount
    buyer_fee = (price * BUYER_FEE_PERCENT / Decimal("100")).quantize(
        KOPECK, rounding=ROUND_HALF_UP
    )
    return {
        "service_id": service.pk,
        "service_revision": service.revision,
        "price_amount": price,
        "currency": service.currency,
        "is_demo": service.is_demo,
        "buyer_fee_percent": BUYER_FEE_PERCENT,
        "buyer_fee_amount": buyer_fee,
        "total_amount": price + buyer_fee,
    }
