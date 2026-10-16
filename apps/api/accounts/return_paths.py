"""Адрес страницы STUDLY после входа не является OAuth redirect_uri."""

from urllib.parse import unquote

from django.utils.http import url_has_allowed_host_and_scheme


def validate_return_path(value):
    """Разрешён только путь от корня текущего origin, без имени хоста."""
    if not isinstance(value, str) or not value or len(value) > 2048:
        raise ValueError("Некорректный путь возврата.")
    candidate = value
    # Проверяем также кодированные слеши/управляющие символы: не создаём
    # неоднозначный Location для браузера или прокси с декодированием URL.
    for _ in range(5):
        if (not candidate.startswith("/") or candidate.startswith("//")
                or "\\" in candidate or candidate != candidate.strip()
                or any(ord(char) < 32 or ord(char) == 127 for char in candidate)
                or not url_has_allowed_host_and_scheme(candidate, allowed_hosts=set())):
            raise ValueError("Некорректный путь возврата.")
        try:
            decoded = unquote(candidate, errors="strict")
        except UnicodeError as exc:
            raise ValueError("Некорректный путь возврата.") from exc
        if decoded == candidate:
            return value
        candidate = decoded
    raise ValueError("Некорректный путь возврата.")
