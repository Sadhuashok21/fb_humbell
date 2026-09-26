from django.db import migrations


DESCRIPTIONS = {
    'blue-oxford': 'A polished blue Oxford shirt with a clean button-front design. An easy choice for workdays, dinners, and everyday wear.',
    'ivory-linen': 'A relaxed ivory linen shirt with a light, breathable feel and an easy silhouette for warm days and laid-back occasions.',
    'midnight-satin': 'A midnight satin shirt with a smooth finish and a dressier look for evening plans and special occasions.',
    'resort-print': 'A cocoa resort print shirt with a relaxed feel and a distinctive pattern, made for holidays and casual days.',
    'white-classic': 'A crisp white poplin shirt with a clean, classic look that works for formal occasions and everyday styling.',
    'navy-jacket': 'A versatile navy overshirt jacket that adds a light extra layer over a tee or shirt. Designed for easy everyday styling.',
    'stone-knit': 'A stone textured knit shirt with a soft-looking surface and relaxed character for comfortable weekend outfits.',
    'black-leather': 'A black premium shacket with a bold layered look. Wear it over a tee or shirt when you want an easy outer layer.',
}


def add_seed_descriptions(apps, schema_editor):
    Product = apps.get_model('store', 'Product')
    for slug, description in DESCRIPTIONS.items():
        Product.objects.filter(slug=slug, description='').update(description=description)


class Migration(migrations.Migration):
    dependencies = [('store', '0007_signupverification')]

    operations = [migrations.RunPython(add_seed_descriptions, migrations.RunPython.noop)]
