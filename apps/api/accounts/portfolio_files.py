"""Ограниченная проверка содержимого. Не антивирус и не публичный PDF viewer."""
from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject
from rest_framework.exceptions import ValidationError

from .avatars import normalize_avatar

MAX_BYTES = 10 * 1024 * 1024


def normalize_example(upload):
    if not upload.size or upload.size > MAX_BYTES:
        raise ValidationError("Нужен непустой файл до 10 МиБ.")
    raw = upload.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValidationError("Размер файла превышает 10 МиБ.")
    if raw.startswith(b"%PDF-"):
        try:
            reader = PdfReader(BytesIO(raw), strict=True)
            if reader.is_encrypted or not 0 < len(reader.pages) <= 100:
                raise ValueError("encrypted or too many pages")
            seen = set()
            nodes = [reader.trailer]
            forbidden = {"/JS", "/JavaScript", "/OpenAction", "/AA", "/Launch", "/EmbeddedFiles", "/EmbeddedFile", "/XFA", "/AcroForm", "/RichMedia", "/URI", "/SubmitForm", "/GoToR"}
            count = 0
            while nodes:
                node = nodes.pop()
                count += 1
                if count > 20000:
                    raise ValueError("object limit")
                if isinstance(node, IndirectObject):
                    key = (node.idnum, node.generation)
                    if key in seen:
                        continue
                    seen.add(key)
                    nodes.append(node.get_object())
                elif isinstance(node, DictionaryObject):
                    if forbidden.intersection(node) or str(node.get("/S", "")) in forbidden or str(node.get("/Type", "")) in forbidden:
                        raise ValueError("active PDF")
                    nodes.extend(node.values())
                elif isinstance(node, ArrayObject):
                    nodes.extend(node)
        except Exception as exc:
            raise ValidationError("PDF повреждён, зашифрован, содержит активные элементы или превышает технические лимиты.") from exc
        return ContentFile(raw, name=f"{uuid4().hex}.pdf"), "application/pdf"
    # Тот же проверенный декодер, отдельный лимит загрузки. EXIF/XMP удаляются.
    upload = ContentFile(raw, name="portfolio")
    from . import avatars
    # normalize_avatar имеет отдельный лимит 5 МиБ; портфолио передаёт свой лимит.
    content = avatars.normalize_avatar(upload, max_bytes=MAX_BYTES)
    return content, "image/png"
