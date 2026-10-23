"""Декодирование разрешённых изображений до записи в закрытое хранилище."""

from io import BytesIO
import logging
from uuid import uuid4
import warnings

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

from .models import RegistrationProgress, User

MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_AVATAR_PIXELS = 16_000_000
logger = logging.getLogger(__name__)


def normalize_avatar(upload, *, max_bytes=MAX_AVATAR_BYTES):
    if upload.size > max_bytes:
        raise ValidationError("Размер аватара не должен превышать 5 МиБ.")
    raw = upload.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValidationError("Размер аватара не должен превышать 5 МиБ.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw), formats=["JPEG", "PNG", "WEBP"]) as image:
                if image.width * image.height > MAX_AVATAR_PIXELS or getattr(image, "n_frames", 1) != 1:
                    raise ValueError("dimensions or animation")
                image.load()
                image = ImageOps.exif_transpose(image)
                image.thumbnail((1024, 1024))
                # Новое изображение не наследует EXIF, XMP, ICC и PNG-текст.
                normalized = Image.new("RGBA", image.size)
                normalized.paste(image.convert("RGBA"))
                result = BytesIO()
                normalized.save(result, format="PNG")
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise ValidationError(
            "Нужен корректный PNG, JPEG или WebP: один кадр, не более 16 миллионов пикселей."
        ) from exc
    return ContentFile(result.getvalue(), name=f"{uuid4().hex}.png")


def remove_stored_avatar(storage, name):
    if name:
        try:
            storage.delete(name)
        except OSError:
            # Не возвращаем ошибку после уже зафиксированного изменения профиля.
            logger.warning("Не удалось удалить прежний файл аватара.")


def save_avatar(user_id, content):
    new_name = None
    storage = User._meta.get_field("avatar").storage
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user_id)
            previous = user.avatar.name
            user.avatar.save(content.name, content, save=False)
            new_name = user.avatar.name
            user.save(update_fields=["avatar"])
            from .moderation import touch_performer
            touch_performer(user)
            progress, _ = RegistrationProgress.objects.get_or_create(user=user)
            progress.save()
            transaction.on_commit(lambda: remove_stored_avatar(storage, previous))
    except Exception:
        remove_stored_avatar(storage, new_name)
        raise


@transaction.atomic
def delete_avatar(user_id):
    user = User.objects.select_for_update().get(pk=user_id)
    previous, storage = user.avatar.name, user.avatar.storage
    if previous:
        user.avatar = ""
        user.save(update_fields=["avatar"])
        from .moderation import touch_performer
        touch_performer(user)
        progress, _ = RegistrationProgress.objects.get_or_create(user=user)
        progress.save()
        transaction.on_commit(lambda: remove_stored_avatar(storage, previous))
