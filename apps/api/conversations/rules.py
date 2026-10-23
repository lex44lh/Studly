"""Версионированные узкие правила. Нет AI, санкций или слова-триггера Telegram."""
import re
import unicodedata

VERSION = "offplatform-2026-10-24-v1"


def classify(text):
    normalized = unicodedata.normalize("NFKC", text).casefold()
    normalized = re.sub(r"[\u200b-\u200f\u2060\ufeff]", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    # Учебная цитата разрешена только при явной маркировке; фактический призыв
    # за закрывающей кавычкой проверяется отдельно.
    normalized = re.sub(r'(?:пример|цитата|в задании)\s*[:—-]?\s*[«"]{1}[^»"]{0,500}[»"]', " ", normalized)
    categories = []
    messenger = r"(?:телеграм(?:м|е)?|telegram|whats?app|ватсап|вацап|viber|вайбер)"
    invitation = rf"(?:давай\w*\s+(?:перейд\w*|уйд\w*)|перейд\w*|напиш\w*\s+(?:мне|мне\s+лучше)?\s*в|свяж\w*\s+со\s+мной\s+в).{{0,55}}{messenger}"
    if re.search(invitation, normalized):
        categories.append("external_messenger")
    messenger_link = bool(re.search(r"(?:https?://)?(?:t\.me|telegram\.me|wa\.me|chat\.whatsapp\.com)/[\w+/-]+", normalized))
    academic_link = bool(re.search(r"(?:условие|задани[ея]|лекци[яи]|материал\w*\s+курса)", normalized))
    if messenger_link and (not academic_link or "external_messenger" in categories):
        categories.append("messenger_contact")
    if re.search(r"(?:скин\w*|пришл\w*|дай\w*|отправ\w*).{0,25}(?:номер\s*(?:телефона)?|телефон|контакт)", normalized):
        categories.append("contact_request")
    if re.search(r"(?:мой\s+(?:номер|телефон)|звони\w*|напиши\w*\s+мне).{0,25}\+?\d[\d ()-]{8,}\d", normalized):
        categories.append("phone_contact")
    if re.search(r"(?:оплат\w*|плат\w*|перевед\w*|перевод\w*).{0,45}(?:напрямую|на\s+карту|мимо\s+(?:studly|платформы)|без\s+комиссии)", normalized):
        categories.append("external_payment")
    if re.search(r"(?:мой|напиши\w*|добав\w*).{0,35}@[a-z0-9_]{5,32}\b", normalized) and re.search(messenger, normalized):
        categories.append("messenger_contact")
    return sorted(set(categories))
