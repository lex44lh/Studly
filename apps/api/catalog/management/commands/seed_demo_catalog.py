"""Четыре существующих прототипа услуг. Не являются настоящими публикациями."""

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from catalog.models import Service

DEMO_SERVICES = [
    {
        "key": "cpp", "name": "Иван Петров",
        "about": "Помогаю студентам с программированием, C++, Python и Telegram-ботами. Опыт более 4 лет.",
        "title": "Помогу с C++", "price_amount": "500.00", "duration_days": 3,
        "description": "Помогу выполнить лабораторные работы, исправить ошибки в коде, объяснить сложные темы по C++.",
        "included": ["Консультация", "Проверка кода", "Исправление ошибок"],
    },
    {
        "key": "python", "name": "Дмитрий Иванов",
        "about": "Помогаю студентам разобраться с Python, алгоритмами и программированием.",
        "title": "Помощь с Python", "price_amount": "900.00", "duration_days": 4,
        "description": "Помогу разобраться с Python, решить учебные задачи, найти ошибки в коде и объяснить сложные темы.",
        "included": ["Консультация", "Разбор кода", "Исправление ошибок"],
    },
    {
        "key": "english", "name": "Анна Смирнова",
        "about": "Репетитор по английскому языку. Помогаю студентам улучшить грамматику, лексику и разговорную речь.",
        "title": "Репетитор по английскому", "price_amount": "700.00", "duration_days": 7,
        "description": "Помогу улучшить английский язык, разобраться с грамматикой, подготовиться к занятиям и выполнить учебные задания.",
        "included": ["Онлайн-консультация", "Разбор заданий", "Объяснение грамматики"],
    },
    {
        "key": "video", "name": "Максим Козлов",
        "about": "Занимаюсь видеомонтажом, обработкой видео, субтитрами и созданием готовых роликов.",
        "title": "Монтаж видео", "price_amount": "1200.00", "duration_days": 5,
        "description": "Смонтирую видео, добавлю переходы, музыку, субтитры и подготовлю готовый ролик.",
        "included": ["Монтаж видео", "Добавление музыки", "Субтитры и переходы"],
    },
]


class Command(BaseCommand):
    help = "Добавить демонстрационные услуги. Повторный запуск сохраняет изменения существующих записей."

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        for source in DEMO_SERVICES:
            existing = Service.objects.filter(demo_key=source["key"]).first()
            if existing:
                if not existing.is_demo:
                    raise CommandError("Демонстрационный ключ занят настоящей услугой.")
                continue
            performer = User.objects.create(
                telegram_id=None, display_name=source["name"], about=source["about"],
                is_active=False, password=make_password(None),
            )
            Service.objects.create(
                performer=performer, demo_key=source["key"], is_demo=True, currency="RUB",
                status=Service.Status.PUBLISHED,
                **{field: source[field] for field in (
                    "title", "description", "price_amount", "duration_days", "included"
                )},
            )
            created_count += 1
        self.stdout.write(self.style.SUCCESS(f"Добавлено демонстрационных услуг: {created_count}."))
