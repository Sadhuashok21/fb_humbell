from django.db import migrations


def add_tshirt_category(apps, schema_editor):
    Category = apps.get_model('store', 'Category')
    Category.objects.get_or_create(
        slug='t-shirts',
        defaults={
            'name': 'T-Shirts',
            'description': 'Everyday T-shirts and casual essentials.',
            'is_active': True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [('store', '0008_product_descriptions')]

    operations = [migrations.RunPython(add_tshirt_category, migrations.RunPython.noop)]
