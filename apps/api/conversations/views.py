from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response

from accounts.portfolio_views import VersionedAction
from accounts.registration_serializers import StrictSerializer
from accounts.registration_views import PrivateRegistrationView
from operations.services import Conflict, audit, execute
from orders.models import Order
from orders.views import OrderPagination
from .models import Conversation, Discussion, Message, MessageSequence, SecurityCase
from .rules import VERSION, classify


def participant_conversations(user):
    return Conversation.objects.filter(Q(order__buyer=user) | Q(order__performer=user) | Q(discussion__buyer=user) | Q(discussion__performer=user)).select_related("order", "discussion")


def conversation_data(item):
    context = item.order if item.order_id else item.discussion
    return {"id": str(item.pk), "order_id": item.order_id,
            "kind": "order" if item.order_id else "discussion", "service_id": context.service_id, "title": context.title,
            "participant_ids": [context.buyer_id, context.performer_id],
            "created_at": item.created_at.isoformat()}


class DiscussionInput(StrictSerializer):
    service_id = serializers.IntegerField(min_value=1, max_value=2**63-1)
    request_key = serializers.UUIDField()


class DiscussionView(PrivateRegistrationView):
    def post(self, request):
        from accounts.models import User
        from accounts.permissions import require_role
        from catalog.models import Service
        from catalog.visibility import public_services
        serializer = DiscussionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        def start():
            initial = get_object_or_404(Service, pk=data["service_id"])
            users = {u.pk: u for u in User.objects.select_for_update().filter(pk__in=[request.user.pk, initial.performer_id]).order_by("pk")}
            require_role(users[request.user.pk], "customer")
            service = get_object_or_404(public_services().select_for_update(of=("self",)), pk=initial.pk)
            if service.performer_id == request.user.pk or service.is_demo:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"service_id": "Нужна реальная услуга другого исполнителя."})
            discussion, created = Discussion.objects.get_or_create(buyer=request.user, service=service,
                    defaults={"performer_id": service.performer_id, "title": service.title})
            conversation, _ = Conversation.objects.get_or_create(discussion=discussion)
            return {"data": conversation_data(conversation), "created": created}
        body, replayed = execute(actor=request.user, operation="discussion.start", data=data, callback=start)
        return Response(body["data"], status=201 if body["created"] and not replayed else 200)


def message_data(item):
    return {"id": item.pk, "sequence": item.sequence_id, "conversation_id": str(item.conversation_id), "sender_id": item.sender_id,
            "client_message_id": str(item.client_message_id), "text": item.text, "status": item.status,
            "categories": item.categories, "rules_version": item.rules_version,
            "warning": "Сообщение удержано. Можно сообщить об ошибке." if item.status == "held" else None,
            "security_case_id": item.security_case.pk if item.status == "held" else None,
            "created_at": item.created_at.isoformat()}


class MessageInput(StrictSerializer):
    client_message_id = serializers.UUIDField()
    text = serializers.CharField(max_length=4000)


class AppealInput(VersionedAction):
    reason = serializers.CharField(max_length=2000, allow_blank=True, default="")


class SecurityDecisionInput(VersionedAction):
    decision = serializers.ChoiceField(choices=["release", "keep"])
    reason = serializers.CharField(max_length=2000)


class ConversationsView(PrivateRegistrationView):
    def get(self, request):
        pager = OrderPagination()
        rows = participant_conversations(request.user).order_by("-created_at", "id")
        return pager.get_paginated_response([conversation_data(x) for x in pager.paginate_queryset(rows, request)])


class OrderConversationView(PrivateRegistrationView):
    def get(self, request, pk):
        item = get_object_or_404(participant_conversations(request.user), order_id=pk)
        return Response(conversation_data(item))


class ConversationView(PrivateRegistrationView):
    def get(self, request, pk):
        return Response(conversation_data(get_object_or_404(participant_conversations(request.user), pk=pk)))


class MessagePagination(CursorPagination):
    page_size = 50
    ordering = "sequence_id"


class MessagesView(PrivateRegistrationView):
    def get(self, request, pk):
        conversation = get_object_or_404(participant_conversations(request.user), pk=pk)
        rows = Message.objects.filter(conversation=conversation).filter(Q(status="stored") | Q(sender=request.user)).select_related("security_case")
        pager = MessagePagination()
        return pager.get_paginated_response([message_data(x) for x in pager.paginate_queryset(rows, request, view=self)])

    def post(self, request, pk):
        # Проверка объекта выполняется и при повторе намерения.
        conversation = get_object_or_404(participant_conversations(request.user), pk=pk)
        serializer = MessageInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payload = {"request_key": data["client_message_id"], "conversation_id": str(pk), "text": data["text"]}
        def send():
            Conversation.objects.select_for_update().get(pk=conversation.pk)
            categories = classify(data["text"])
            item = Message.objects.create(conversation=conversation, sender=request.user, client_message_id=data["client_message_id"],
                                          text=data["text"], status="held" if categories else "stored", categories=categories,
                                          rules_version=VERSION, sequence=MessageSequence.objects.create())
            if categories:
                SecurityCase.objects.create(message=item)
                audit(request.user, "message.held", item.pk, categories=categories, rules_version=VERSION)
            return message_data(item)
        body, replayed = execute(actor=request.user, operation="message.send", data=payload, callback=send)
        return Response(body, status=200 if replayed else 201)


def case_data(case):
    return {"id": case.pk, "message_id": case.message_id, "conversation_id": str(case.message.conversation_id),
            "revision": case.revision, "categories": case.message.categories, "rules_version": case.message.rules_version,
            "appealed": case.appealed, "appeal_reason": case.appeal_reason,
            "decision": case.decision or None, "decision_reason": case.decision_reason}


class AppealView(PrivateRegistrationView):
    def get(self, request, pk):
        case = get_object_or_404(SecurityCase.objects.select_related("message"), pk=pk, message__sender=request.user)
        return Response(case_data(case))

    def post(self, request, pk):
        serializer = AppealInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "case_id": pk}
        def appeal():
            case = get_object_or_404(SecurityCase.objects.select_for_update(of=("self",)).select_related("message"), pk=pk, message__sender=request.user)
            if case.revision != data["revision"] or case.appealed or case.decision:
                raise Conflict()
            case.appealed = True
            case.appeal_reason = data["reason"]
            case.revision += 1
            case.save()
            audit(request.user, "security.appeal", case.pk, revision=case.revision)
            return case_data(case)
        body, _ = execute(actor=request.user, operation="security.appeal", data=data, callback=appeal)
        return Response(body)


def require_security_staff(user):
    if not user.is_staff or not user.has_perm("conversations.review_security_case"):
        raise PermissionDenied()


class SecurityCaseView(PrivateRegistrationView):
    def get(self, request, pk):
        require_security_staff(request.user)
        reason = request.query_params.get("purpose", "").strip()
        if not reason or len(reason) > 500:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"purpose": "Укажите рабочее основание просмотра до 500 символов."})
        case = get_object_or_404(SecurityCase.objects.select_related("message__conversation__order"), pk=pk)
        audit(request.user, "security.view", case.pk, purpose=reason)
        return Response({**case_data(case), "message": message_data(case.message)})

    def post(self, request, pk):
        require_security_staff(request.user)
        serializer = SecurityDecisionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {**serializer.validated_data, "case_id": pk}
        def decide():
            case = get_object_or_404(SecurityCase.objects.select_for_update(of=("self",)).select_related("message__conversation__order"), pk=pk)
            conversation = case.message.conversation
            context = conversation.order if conversation.order_id else conversation.discussion
            if request.user.pk in (context.buyer_id, context.performer_id):
                raise PermissionDenied("Участник не рассматривает свой случай.")
            if case.revision != data["revision"] or case.decision:
                raise Conflict()
            case.decision = data["decision"]
            case.decision_reason = data["reason"]
            case.revision += 1
            case.save()
            if case.decision == "release":
                case.message.status = "stored"
                case.message.sequence = MessageSequence.objects.create()
                case.message.save(update_fields=["status", "sequence"])
            audit(request.user, "security.decide", case.pk, revision=case.revision, decision=case.decision, reason=case.decision_reason)
            return case_data(case)
        body, _ = execute(actor=request.user, operation="security.decide", data=data, callback=decide)
        return Response(body)
