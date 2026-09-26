from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('store', '0003_product_image_alter_product_image_url')]
    operations = [migrations.DeleteModel(name='Review')]