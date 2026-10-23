"""Оформление и переходы неоплаченных заказов. Денежных операций здесь нет."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from catalog.models import Service
from catalog.pricing import calculate_buyer_quote
from catalog.visibility import public_services
from accounts.models import PerformerProfile, User
from accounts.permissions import require_role
from .models import Order, OrderEvent


class OrderConflict(APIException):
    status_code = 409
    default_detail = "Условия запроса изменились."
    default_code = "conflict"


def _existing_order(buyer, data):
    order = Order.objects.select_related("buyer", "performer", "closed_by").filter(
        buyer=buyer, request_key=data["request_key"]
    ).first()
    if order is not None and (
        order.service_id != data["service_id"]
        or order.service_revision != data["service_revision"]
        or order.quote_id is not None
    ):
        raise OrderConflict({"request_key": "Этот ключ уже использован для других условий заказа."})
    return order


@transaction.atomic
def create_order(*, buyer, data):
    existing = _existing_order(buyer, data)
    if existing is not None:
        return existing, False

    initial = Service.objects.filter(pk=data["service_id"]).only("performer_id").first()
    if initial is None:
        raise NotFound("Опубликованная услуга не найдена.")
    users = {user.pk: user for user in User.objects.select_for_update().filter(
        pk__in=[buyer.pk, initial.performer_id]).order_by("pk")}
    buyer = users[buyer.pk]
    require_role(buyer, "customer")

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
    if not service.performer.is_performer or not PerformerProfile.objects.filter(user_id=service.performer_id, moderation_status="approved").exists():
        raise NotFound("Опубликованная услуга не найдена.")
    if not public_services().filter(pk=service.pk).exists():
        raise NotFound("Опубликованная услуга не найдена.")

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
    from conversations.models import Conversation
    Conversation.objects.create(order=order)
    OrderEvent.objects.create(order=order, actor=buyer, action="created", revision=order.revision)
    return order, True


def _locked_order_for_participant(user, pk):
    # Сначала ограничиваем выборку участниками, чтобы не раскрывать чужие заказы.
    order = Order.objects.select_for_update(of=("self",)).select_related("buyer", "performer", "closed_by").filter(
        Q(buyer=user) | Q(performer=user), pk=pk
    ).first()
    if order is None:
        raise NotFound("Заказ не найден.")
    return order


@transaction.atomic
def accept_order(*, user, pk):
    order = _locked_order_for_participant(user, pk)
    if order.performer_id != user.pk:
        raise PermissionDenied("Дать согласие может только исполнитель заказа.")
    if order.status == Order.Status.AWAITING_PAYMENT:
        return order
    if order.status != Order.Status.PENDING_ACCEPTANCE:
        raise OrderConflict("Согласие недоступно в текущем состоянии заказа.")
    order.status = Order.Status.AWAITING_PAYMENT
    order.accepted_at = timezone.now()
    order.revision += 1
    order.save(update_fields=["status", "accepted_at", "revision"])
    OrderEvent.objects.create(order=order, actor=user, action="accepted", revision=order.revision)
    return order


@transaction.atomic
def cancel_order(*, user, pk):
    order = _locked_order_for_participant(user, pk)
    if order.buyer_id != user.pk:
        raise PermissionDenied("Отменить заказ может только заказчик.")
    if order.status == Order.Status.CANCELLED:
        return order
    if order.status not in (Order.Status.PENDING_ACCEPTANCE, Order.Status.AWAITING_PAYMENT):
        raise OrderConflict("Отмена недоступна в текущем состоянии заказа.")
    return _close_order(order, user, Order.Status.CANCELLED)


@transaction.atomic
def decline_order(*, user, pk):
    order = _locked_order_for_participant(user, pk)
    if order.performer_id != user.pk:
        raise PermissionDenied("Отказаться от заказа может только исполнитель.")
    if order.status == Order.Status.DECLINED:
        return order
    if order.status != Order.Status.PENDING_ACCEPTANCE:
        raise OrderConflict("Отказ возможен только до согласия исполнителя.")
    return _close_order(order, user, Order.Status.DECLINED)


def _close_order(order, user, status):
    order.status = status
    order.closed_at = timezone.now()
    order.closed_by = user
    order.revision += 1
    order.save(update_fields=["status", "closed_at", "closed_by", "revision"])
    OrderEvent.objects.create(order=order, actor=user, action=status, revision=order.revision)
    return order
