"""Оформление заказа и согласие исполнителя. Денежных операций здесь нет."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from catalog.models import Service
from catalog.pricing import calculate_buyer_quote
from .models import Order


class OrderConflict(APIException):
    status_code = 409
    default_detail = "Условия запроса изменились."
    default_code = "conflict"


def _existing_order(buyer, data):
    order = Order.objects.select_related("buyer", "performer").filter(
        buyer=buyer, request_key=data["request_key"]
    ).first()
    if order is not None and (
        order.service_id != data["service_id"]
        or order.service_revision != data["service_revision"]
    ):
        raise OrderConflict({"request_key": "Этот ключ уже использован для других условий заказа."})
    return order


@transaction.atomic
def create_order(*, buyer, data):
    existing = _existing_order(buyer, data)
    if existing is not None:
        return existing, False

    # Та же строка блокируется при редактировании услуги и её модерации.
    service = Service.objects.select_for_update(of=("self",)).select_related("performer").filter(
        pk=data["service_id"]
    ).first()
    # Другой запрос мог оформить заказ, пока мы ждали блокировку услуги.
    existing = _existing_order(buyer, data)
    if existing is not None:
        return existing, False
    if service is None or service.status != Service.Status.PUBLISHED:
        raise NotFound("Опубликованная услуга не найдена.")
    if service.revision != data["service_revision"]:
        raise OrderConflict({"service_revision": "Услуга изменилась. Получите новый расчёт и подтвердите условия."})
    if service.is_demo:
        raise ValidationError({"service_id": "Демонстрационную услугу нельзя заказать."})
    if service.performer_id == buyer.pk:
        raise ValidationError({"service_id": "Нельзя заказать собственную услугу."})
    if not service.performer.is_active:
        raise ValidationError({"service_id": "Исполнитель сейчас недоступен."})
    if service.price_amount <= 0:
        raise ValidationError({"service_id": "Для заказа требуется положительная цена услуги."})
    if service.currency != "RUB":
        raise ValidationError({"service_id": "Оформление доступно только для услуг в RUB."})

    quote = calculate_buyer_quote(service)
    try:
        # Отдельная точка сохранения позволяет прочитать заказ после конфликта
        # уникальности, не оставляя внешнюю транзакцию в состоянии ошибки.
        with transaction.atomic():
            order = Order.objects.create(
                buyer=buyer, performer=service.performer, service=service,
                service_revision=service.revision, request_key=data["request_key"],
                title=service.title, description=service.description,
                included=service.included, duration_days=service.duration_days,
                price_amount=quote["price_amount"], currency=quote["currency"],
                buyer_fee_percent=quote["buyer_fee_percent"],
                buyer_fee_amount=quote["buyer_fee_amount"], total_amount=quote["total_amount"],
            )
    except IntegrityError:
        # Один ключ мог прийти одновременно для разных услуг.
        existing = _existing_order(buyer, data)
        if existing is None:
            raise
        return existing, False
    return order, True


@transaction.atomic
def accept_order(*, user, pk):
    # Сначала ограничиваем выборку участниками, чтобы не раскрывать чужие заказы.
    order = Order.objects.select_for_update(of=("self",)).select_related("buyer", "performer").filter(
        Q(buyer=user) | Q(performer=user), pk=pk
    ).first()
    if order is None:
        raise NotFound("Заказ не найден.")
    if order.performer_id != user.pk:
        raise PermissionDenied("Дать согласие может только исполнитель заказа.")
    if order.status == Order.Status.AWAITING_PAYMENT:
        return order
    if order.status != Order.Status.PENDING_ACCEPTANCE:
        raise OrderConflict("Согласие недоступно в текущем состоянии заказа.")
    order.status = Order.Status.AWAITING_PAYMENT
    order.accepted_at = timezone.now()
    order.save(update_fields=["status", "accepted_at"])
    return order
