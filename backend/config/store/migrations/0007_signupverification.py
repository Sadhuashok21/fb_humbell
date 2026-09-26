from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0006_order_stock_deducted'),
    ]

    operations = [
        migrations.CreateModel(
            name='SignupVerification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('code_hash', models.CharField(max_length=256)),
                ('expires_at', models.DateTimeField()),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
            ],
            options={'abstract': False},
        ),
    ]
