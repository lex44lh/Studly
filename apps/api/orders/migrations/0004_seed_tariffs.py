from decimal import Decimal
from django.db import migrations


def seed(apps, schema_editor):
    Tariff = apps.get_model("orders", "Tariff")
    for code, percent in (("buyer-3-v1", "3.00"), ("buyer-5-v1", "5.00")):
        Tariff.objects.using(schema_editor.connection.alias).get_or_create(code=code, defaults={"buyer_fee_percent": Decimal(percent)})


class Migration(migrations.Migration):
    dependencies = [("orders", "0003_order_base_price_amount_order_revision_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
