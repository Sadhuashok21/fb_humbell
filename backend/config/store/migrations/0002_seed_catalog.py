from django.db import migrations


CATALOG = [
    ('blue-oxford', 'Signature Blue Oxford Shirt', 'HUMBELL SIGNATURE', 1499, 2499, 'Sky Blue', 'Bestseller', 'https://images.unsplash.com/photo-1596732395264-36901fb0db89?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('ivory-linen', 'Ivory Linen Relaxed Shirt', 'HUMBELL LINEN', 1799, 2999, 'Ivory', 'New', 'https://images.unsplash.com/photo-1627686011747-74adda3d2343?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('midnight-satin', 'Midnight Satin Party Shirt', 'HUMBELL NIGHT', 1299, 2199, 'Midnight', 'Trending', 'https://images.unsplash.com/photo-1599820638992-27aafc6c026b?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('resort-print', 'Cocoa Resort Print Shirt', 'HUMBELL EDIT', 1599, 2799, 'Cocoa', 'Top rated', 'https://images.unsplash.com/photo-1536766820879-059fec98ec0a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('white-classic', 'Classic White Poplin Shirt', 'HUMBELL FORMAL', 1199, 1999, 'White', 'Essential', 'https://images.unsplash.com/photo-1643930757648-b0ec5c7a9dfa?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('navy-jacket', 'Navy Overshirt Jacket', 'HUMBELL LAYERS', 2299, 3499, 'Navy', 'Limited', 'https://images.unsplash.com/photo-1539125530496-3ca408f9c2d9?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('stone-knit', 'Stone Textured Knit Shirt', 'HUMBELL WEEKEND', 1399, 2299, 'Stone', 'New', 'https://images.unsplash.com/photo-1664856514301-08d72e3f1d4f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
    ('black-leather', 'Black Premium Shacket', 'HUMBELL BLACK', 2599, 4299, 'Black', 'Premium', 'https://images.unsplash.com/photo-1618902752068-62a02e3b2453?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=980'),
]


def seed_catalog(apps, schema_editor):
    Category = apps.get_model('store', 'Category')
    Product = apps.get_model('store', 'Product')
    ProductVariant = apps.get_model('store', 'ProductVariant')
    category = Category.objects.create(name='Shirts', slug='shirts', description='Thoughtfully designed shirts for every occasion.')
    for slug, name, brand, price, compare_at_price, color, tag, image_url in CATALOG:
        product = Product.objects.create(
            slug=slug,
            name=name,
            brand=brand,
            color=color,
            price=price,
            compare_at_price=compare_at_price,
            image_url=image_url,
            category=category,
            tag=tag,
            is_featured=slug in {'blue-oxford', 'ivory-linen', 'resort-print'},
        )
        for size in ('S', 'M', 'L', 'XL', 'XXL'):
            ProductVariant.objects.create(product=product, size=size, sku=f'HBL-{slug.upper()}-{size}', stock_quantity=32)


def remove_catalog(apps, schema_editor):
    apps.get_model('store', 'Category').objects.filter(slug='shirts').delete()


class Migration(migrations.Migration):
    dependencies = [('store', '0001_initial')]
    operations = [migrations.RunPython(seed_catalog, remove_catalog)]