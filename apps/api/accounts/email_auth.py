"""Email credentials supplement the canonical User; tokens never reach responses."""
import hashlib
import hmac
import ipaddress
import math
import re
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import UserAttributeSimilarityValidator, validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.views.decorators.debug import sensitive_variables

from .models import EmailAttempt, EmailChallenge, EmailCredential, User

TELEGRAM_PROOF = "studly_recent_telegram_login"
NEUTRAL_DETAIL = "Если действие доступно, инструкция отправлена на почту."
USERNAME = re.compile(r"[a-z0-9][a-z0-9_.-]{2,31}\Z", re.ASCII)


class EmailError(Exception):
    def __init__(self, code, detail, status=400, retry_after=None):
        self.code, self.detail, self.status, self.retry_after = code, detail, status, retry_after
        super().__init__(code)


def invalid_token():
    return EmailError("invalid_email_token", "Ссылка недействительна или срок её действия истёк.")


def canonical_email(value):
    value = value.strip()
    if not value.isascii() or len(value) > 254:
        raise DjangoValidationError("Укажите корректный email ASCII до 254 символов.")
    value = value.lower()
    validate_email(value)
    domain = getattr(settings, "STUDLY_EMAIL_TEST_DOMAIN", "")
    if domain and value.rsplit("@", 1)[-1] != domain:
        raise DjangoValidationError("В тестовой среде разрешён только тестовый домен.")
    return value


def canonical_username(value):
    value = value.strip()
    if not value.isascii():
        raise DjangoValidationError("Логин должен содержать только ASCII символы.")
    value = value.lower()
    if not USERNAME.fullmatch(value):
        raise DjangoValidationError("Логин: 3–32 ASCII символа a-z, 0-9, _, . или -, первый — буква или цифра.")
    return value


@sensitive_variables()
def checked_password(value, user):
    if not 12 <= len(value) <= 128:
        raise DjangoValidationError("Пароль должен содержать от 12 до 128 символов.")
    validate_password(value, user=user)
    UserAttributeSimilarityValidator(user_attributes=("email", "email_login_username")).validate(value, user)
    return value


def mark_telegram_login(request, user):
    request.session[TELEGRAM_PROOF] = {"user_id": user.pk, "at": timezone.now().timestamp()}


def recent_telegram(request, user):
    proof = request.session.get(TELEGRAM_PROOF)
    if not isinstance(proof, dict) or proof.get("user_id") != user.pk or not user.telegram_id:
        return False
    try:
        age = timezone.now().timestamp() - float(proof["at"])
    except (TypeError, ValueError, KeyError, OverflowError):
        return False
    return math.isfinite(age) and 0 <= age <= 600 and user.is_active and not user.is_staff and not user.is_superuser


def require_recent_telegram(request, user):
    if not recent_telegram(request, user):
        raise EmailError("telegram_reauthentication_required", "Повторите вход через Telegram для привязки почты.", 403)


def client_ip(request):
    remote = request.META.get("REMOTE_ADDR", "")
    trusted = remote in ("", "unix", "unix:", "127.0.0.1", "::1")
    if getattr(settings, "STUDLY_EMAIL_TRUST_NGINX", False) and trusted:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[-1].strip()
        try:
            return str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    try:
        return str(ipaddress.ip_address(remote))
    except ValueError:
        return "unknown"


def throttle(request, action, subject, *, ip_limit, subject_limit, seconds):
    """DB rows, not process memory: aliases share an account key at login."""
    specifications = [("ip", client_ip(request), ip_limit), ("subject", subject, subject_limit)]
    keys = [(salted_hmac("studly.email-attempt", f"{action}:{scope}:{value}", algorithm="sha256").hexdigest(), limit)
            for scope, value, limit in specifications]
    with transaction.atomic():
        for key, limit in sorted(keys):
            row = EmailAttempt.objects.select_for_update().filter(pk=key).first()
            if row is None:
                EmailAttempt.objects.get_or_create(key=key, defaults={"window_started_at": timezone.now(), "count": 0})
                row = EmailAttempt.objects.select_for_update().get(pk=key)
            # Read the clock only after acquiring the row; a waiter may see a new window.
            now = timezone.now()
            elapsed = max(0, (now - row.window_started_at).total_seconds())
            if elapsed >= seconds:
                row.window_started_at, row.count = now, 0
            if row.count >= limit:
                raise EmailError("rate_limited", "Слишком много попыток. Повторите позже.", 429,
                                 max(1, math.ceil(seconds - max(elapsed, 0))))
            row.count += 1
            row.save(update_fields=["window_started_at", "count"])


def token_digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def action_url():
    value = getattr(settings, "STUDLY_EMAIL_ACTION_URL", "")
    parsed = urlsplit(value)
    loopback = parsed.hostname in ("localhost", "127.0.0.1", "::1")
    local_http = settings.DEBUG and parsed.scheme == "http" and loopback
    if (parsed.scheme != "https" and not local_http) or not parsed.hostname or parsed.username or parsed.password or parsed.fragment or parsed.query:
        raise EmailError("email_auth_unavailable", "Вход по почте временно недоступен.", 503)
    return value


def proof_for(selector, purpose):
    return salted_hmac("studly.email-challenge-proof", f"{selector}:{purpose}", algorithm="sha256").hexdigest()


@sensitive_variables()
def send_challenge_email(challenge):
    """Called only by the delivery command; plaintext exists only for transport."""
    canonical_email(challenge.email)
    token = f"{challenge.selector}.{proof_for(challenge.selector, challenge.purpose)}"
    action = "reset" if challenge.purpose == EmailChallenge.Purpose.RESET else "verify"
    link = f"{action_url()}#token={token}&action={action}"
    return bool(send_mail("Действие в STUDLY", "Если вы запрашивали действие в STUDLY, откройте ссылку:\n" + link +
        "\nЕсли вы не отправляли запрос, проигнорируйте письмо. Не передавайте ссылку другим людям.",
        settings.DEFAULT_FROM_EMAIL, [challenge.email], fail_silently=False))


def ordinary(user):
    return user.is_active and not user.is_staff and not user.is_superuser


@sensitive_variables()
def issue(request, email, purpose):
    action_url()  # Fail closed before a DB change or external delivery.
    throttle(request, f"request.{purpose}", email, ip_limit=20, subject_limit=3, seconds=3600)
    selector = secrets.token_hex(32)
    user = None
    allowed = True
    if purpose == EmailChallenge.Purpose.LINK:
        user = request.user
        require_recent_telegram(request, user)
    elif purpose == EmailChallenge.Purpose.RESET:
        credential = EmailCredential.objects.select_related("user").filter(email=email).first()
        user = credential.user if credential else None
        allowed = bool(user and ordinary(user))
    else:
        allowed = not EmailCredential.objects.filter(email=email).exists()
    with transaction.atomic():
        if user:
            user = User.objects.select_for_update().filter(pk=user.pk).first()
            if user is None:
                return
            allowed = allowed and ordinary(user)
            if purpose == EmailChallenge.Purpose.LINK:
                require_recent_telegram(request, user)
                allowed = allowed and not EmailCredential.objects.filter(user=user).exists()
                allowed = allowed and not EmailCredential.objects.filter(email=email).exists()
            elif purpose == EmailChallenge.Purpose.RESET:
                allowed = allowed and EmailCredential.objects.filter(user=user, email=email).exists()
        if allowed:
            EmailChallenge.objects.create(purpose=purpose, selector=selector, email=email,
                user=user, expires_at=timezone.now() + timedelta(minutes=30 if purpose == EmailChallenge.Purpose.RESET else 60))


@sensitive_variables()
def challenge_for(token, purposes):
    try:
        selector, proof = token.split(".")
    except ValueError:
        raise invalid_token() from None
    if not re.fullmatch(r"[0-9a-f]{64}", selector) or not re.fullmatch(r"[0-9a-f]{64}", proof):
        raise invalid_token()
    # Verify the proof before querying storage; a DB selector is not a bearer secret.
    valid = False
    for purpose in purposes:
        valid |= hmac.compare_digest(proof, proof_for(selector, purpose))
    if not valid:
        raise invalid_token()
    candidate = EmailChallenge.objects.filter(selector=selector, purpose__in=purposes).first()
    if candidate is None or not hmac.compare_digest(proof, proof_for(candidate.selector, candidate.purpose)):
        raise invalid_token()
    return candidate


@sensitive_variables()
def verify(request, token, username, password):
    throttle(request, "verify", token_digest(token), ip_limit=30, subject_limit=10, seconds=900)
    candidate = challenge_for(token, [EmailChallenge.Purpose.REGISTER, EmailChallenge.Purpose.LINK])
    try:
        with transaction.atomic():
            # A linked account always precedes its challenge in lock order.
            user = User.objects.select_for_update().filter(pk=candidate.user_id).first() if candidate.user_id else None
            challenge = EmailChallenge.objects.select_for_update().filter(pk=candidate.pk).first()
            if not challenge or challenge.sent_at is None or challenge.expires_at <= timezone.now():
                raise invalid_token()
            canonical_email(challenge.email)  # Synthetic policy also applies to existing proofs.
            if challenge.purpose == EmailChallenge.Purpose.LINK:
                if not user or request.user.pk != user.pk:
                    raise invalid_token()
                require_recent_telegram(request, user)
                if EmailCredential.objects.filter(user=user).exists():
                    raise invalid_token()
            else:
                if challenge.user_id is not None:
                    raise invalid_token()
                user = User(telegram_id=None)
            user.email = challenge.email
            user.email_login_username = username
            checked_password(password, user)
            user.set_password(password)
            if user.pk:
                user.save(update_fields=["password"])
            else:
                user.email = ""
                user.save()
            EmailCredential.objects.create(user=user, email=challenge.email, username=username, verified_at=timezone.now())
            challenge.delete()
            return user
    except IntegrityError:
        raise EmailError("invalid_registration", "Не удалось завершить регистрацию. Проверьте логин или запросите новую ссылку.") from None


@sensitive_variables()
def login_user(request, identifier, password):
    raw = identifier.strip()
    normalized = raw.lower() if raw.isascii() else ""
    credential = EmailCredential.objects.filter(**{"email" if "@" in normalized else "username": normalized}).first() if normalized else None
    if credential:
        try:
            canonical_email(credential.email)
        except DjangoValidationError:
            credential = None
    subject = f"account:{credential.user_id}" if credential else "identifier:" + normalized
    throttle(request, "login", subject, ip_limit=60, subject_limit=10, seconds=900)
    user = None
    if credential:
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=credential.user_id).first()
            if user:
                valid = check_password(password, user.password)
                valid = valid and ordinary(user) and bool(credential.verified_at)
            else:
                make_password(password)
                valid = False
    else:
        make_password(password)
        valid = False
    if not valid:
        raise EmailError("invalid_credentials", "Неверные данные для входа.", 401)
    return user


@sensitive_variables()
def reset_password(request, token, password):
    throttle(request, "reset.confirm", token_digest(token), ip_limit=30, subject_limit=10, seconds=900)
    candidate = challenge_for(token, [EmailChallenge.Purpose.RESET])
    with transaction.atomic():
        user = User.objects.select_for_update().filter(pk=candidate.user_id).first()
        challenge = EmailChallenge.objects.select_for_update().filter(pk=candidate.pk).first()
        if (not user or not ordinary(user) or not challenge or challenge.sent_at is None or challenge.expires_at <= timezone.now()
                or not EmailCredential.objects.filter(user=user, email=challenge.email).exists()):
            raise invalid_token()
        canonical_email(challenge.email)
        credential = EmailCredential.objects.get(user=user)
        user.email = credential.email
        user.email_login_username = credential.username
        checked_password(password, user)
        user.set_password(password)
        user.save(update_fields=["password"])
        EmailChallenge.objects.filter(user=user, purpose=EmailChallenge.Purpose.RESET).delete()
