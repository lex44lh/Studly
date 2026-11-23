import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_portfolioexample_alter_performerprofile_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailAttempt",
            fields=[
                ("key", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("window_started_at", models.DateTimeField(db_index=True)),
                ("count", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name="EmailCredential",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.CharField(max_length=254, unique=True)),
                ("username", models.CharField(max_length=32, unique=True)),
                ("verified_at", models.DateTimeField()),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="email_credential", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(email=Lower("email")) & ~models.Q(email=""),
                        name="email_credential_email_canonical",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(username=Lower("username")) & ~models.Q(username=""),
                        name="email_credential_username_canonical",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="EmailChallenge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("purpose", models.CharField(choices=[("register", "Регистрация"), ("link", "Привязка email"), ("reset", "Сброс пароля")], max_length=16)),
                ("selector", models.CharField(max_length=64, unique=True)),
                ("email", models.CharField(max_length=254)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="email_challenges", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["expires_at"], condition=models.Q(sent_at__isnull=True),
                        name="email_challenge_unsent_idx",
                    ),
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=(
                            models.Q(purpose="register", user__isnull=True)
                            | models.Q(purpose__in=["link", "reset"], user__isnull=False)
                        ),
                        name="email_challenge_purpose_user_valid",
                    ),
                ],
            },
        ),
    ]
