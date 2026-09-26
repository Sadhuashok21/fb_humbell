from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0005_productimage'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='stock_deducted',
            field=models.BooleanField(default=False),
        ),
    ]
