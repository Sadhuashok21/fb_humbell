import re

from django.db import migrations


def classify_tshirts(apps, schema_editor):
    Category = apps.get_model('store', 'Category')
    Product = apps.get_model('store', 'Product')
    tshirts = Category.objects.filter(slug='t-shirts').first()
    shirts = Category.objects.filter(slug='shirts').first()
    if not tshirts or not shirts:
        return
    pattern = re.compile(r'(^|[^a-z])t[- ]?shirts?([^a-z]|$)|(^|[^a-z])tees?([^a-z]|$)', re.IGNORECASE)
    for product in Product.objects.filter(category__in=[shirts, tshirts]).iterator():
        is_tshirt = bool(pattern.search(product.name) or pattern.search(product.slug))
        target = tshirts if is_tshirt else shirts
        if product.category_id != target.id:
            Product.objects.filter(pk=product.pk).update(category=target)


class Migration(migrations.Migration):
    dependencies = [('store', '0010_classify_tshirt_products')]

    operations = [migrations.RunPython(classify_tshirts, migrations.RunPython.noop)]
