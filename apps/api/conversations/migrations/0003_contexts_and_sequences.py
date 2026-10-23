import django.db.models.deletion
from django.db import migrations, models


def prepare(apps, schema_editor):
    alias = schema_editor.connection.alias
    Order = apps.get_model("orders", "Order")
    Conversation = apps.get_model("conversations", "Conversation")
    Message = apps.get_model("conversations", "Message")
    Sequence = apps.get_model("conversations", "MessageSequence")
    for order in Order.objects.using(alias).iterator():
        Conversation.objects.using(alias).get_or_create(order_id=order.pk)
    for message in Message.objects.using(alias).filter(sequence__isnull=True).iterator():
        message.sequence_id = Sequence.objects.using(alias).create().pk
        message.save(using=alias, update_fields=["sequence"])


class Migration(migrations.Migration):
    dependencies = [("conversations", "0002_messagesequence_message_sequence")]
    operations = [migrations.RunPython(prepare, migrations.RunPython.noop),
                  migrations.AlterField(model_name="message", name="sequence", field=models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, to="conversations.messagesequence"))]
