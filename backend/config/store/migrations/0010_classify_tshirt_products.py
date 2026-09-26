from django.db import migrations
import re


def classify_named_tshirts(apps, schema_editor):
    Category = apps.get_model('store', 'Category')
    Product = apps.get_model('store', 'Product')
    category = Category.objects.filter(slug='t-shirts').first()
    shirts = Category.objects.filter(slug='shirts').first()
    if not category or not shirts:
        return
    pattern = re.compile(r'(^|[^a-z])t[- ]?shirts?([^a-z]|$)|(^|[^a-z])tees?([^a-z]|$)', re.IGNORECASE)
    for product in Product.objects.filter(category=shirts).iterator():
        if pattern.search(product.name) or pattern.search(product.slug):
            Product.objects.filter(pk=product.pk).update(category=category)


class Migration(migrations.Migration):
    dependencies = [('store', '0009_tshirt_category')]

    operations = [migrations.RunPython(classify_named_tshirts, migrations.RunPython.noop)]
