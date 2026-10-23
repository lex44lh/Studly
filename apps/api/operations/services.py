import hashlib
import json

from django.db import transaction
from rest_framework.exceptions import APIException

from .models import AuditEvent, Receipt


class Conflict(APIException):
    status_code = 409
    default_detail = "Редакция или состояние изменились. Перечитайте данные."
    default_code = "conflict"


@transaction.atomic
def execute(*, actor, operation, data, callback):
    """Unique receipt сериализует одинаковое намерение, включая разные target."""
    signature = hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()
    receipt, created = Receipt.objects.get_or_create(
        actor=actor, operation=operation, request_key=data["request_key"], defaults={"signature": signature},
    )
    if not created:
        if receipt.signature != signature or receipt.response is None:
            raise Conflict("Ключ уже использован для другого намерения.")
        return receipt.response, True
    response = callback()
    receipt.response = response
    receipt.save(update_fields=["response"])
    return response, False


def audit(actor, operation, target, **details):
    return AuditEvent.objects.create(actor=actor, operation=operation, target=str(target), details=details)
