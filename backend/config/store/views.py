import json
import time
import importlib
import logging
import secrets
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

razorpay = importlib.import_module('razorpay')

from django.contrib.auth import authenticate, get_user_model, password_validation
from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q, Count, Sum
from django.db.models.deletion import ProtectedError
from django.utils.text import slugify
from django.utils import timezone
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_scope
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated

from .models import Address, Cart, CartItem, Category, CustomerProfile, Order, OrderItem, Product, ProductImage, ProductVariant, SignupVerification, SupportTicket, WishlistItem

logger = logging.getLogger(__name__)


class IsSuperuser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active and request.user.is_superuser)


def product_data(product):
    variants = list(product.variants.values('id', 'size', 'sku', 'stock_quantity'))
    images = []
    if product.image:
        images.append(product.image.url)
    images.extend(image.image.url for image in product.gallery_images.all())
    if product.image_url and product.image_url not in images:
        images.append(product.image_url)
    return {
        'id': product.id,
        'slug': product.slug,
        'name': product.name,
        'brand': product.brand,
        'description': product.description,
        'color': product.color,
        'price': str(product.price),
        'compare_at_price': str(product.compare_at_price) if product.compare_at_price else None,
        'image': images[0] if images else '',
        'images': images,
        'tag': product.tag,
        'category': product.category.name,
        'variants': variants,
    }


@require_http_methods(['GET'])
def product_list(request):
    products = Product.objects.filter(is_active=True).select_related('category').prefetch_related('variants', 'gallery_images')
    category = request.GET.get('category')
    search = request.GET.get('q')
    brands = [value for value in request.GET.get('brand', '').split(',') if value]
    sizes = [value for value in request.GET.get('size', '').split(',') if value]
    colors = [value for value in request.GET.get('color', '').split(',') if value]
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    discount = request.GET.get('discount')
    sort = request.GET.get('sort')
    if category:
        products = products.filter(category__slug=category)
    if search:
        products = products.filter(name__icontains=search)
    if brands:
        products = products.filter(Q(*[Q(brand__iexact=brand) for brand in brands], _connector=Q.OR))
    if sizes:
        products = products.filter(variants__size__in=sizes)
    if colors:
        products = products.filter(Q(*[Q(color__iexact=color) for color in colors], _connector=Q.OR))
    if min_price:
        products = products.filter(price__gte=min_price)
    if max_price:
        products = products.filter(price__lte=max_price)
    products = products.distinct()
    if sort == 'new':
        products = products.order_by('-created_at')
    elif sort == 'best':
        products = products.order_by('-is_featured', '-created_at')
    data = [product_data(product) for product in products]
    if discount:
        data = [product for product in data if product['compare_at_price'] and (1 - float(product['price']) / float(product['compare_at_price'])) * 100 >= float(discount)]
    return JsonResponse({'count': len(data), 'results': data})


@require_http_methods(['GET'])
def product_detail(request, slug):
    product = get_object_or_404(Product.objects.select_related('category').prefetch_related('variants', 'gallery_images'), slug=slug, is_active=True)
    return JsonResponse(product_data(product))


@require_http_methods(['GET'])
def category_list(request):
    categories = Category.objects.filter(is_active=True).values('id', 'name', 'slug', 'description', 'image_url')
    return JsonResponse({'results': list(categories)})


@require_http_methods(['GET'])
def product_filters(request):
    products = Product.objects.filter(is_active=True)
    return JsonResponse({
        'categories': list(Category.objects.filter(is_active=True).values('name', 'slug')),
        'brands': sorted(set(products.values_list('brand', flat=True))),
        'sizes': sorted(set(ProductVariant.objects.filter(product__is_active=True).values_list('size', flat=True))),
        'colors': sorted(set(products.exclude(color='').values_list('color', flat=True))),
        'price': {'min': str(products.order_by('price').values_list('price', flat=True).first() or 0), 'max': str(products.order_by('-price').values_list('price', flat=True).first() or 0)},
    })


def admin_product_data(product):
    data = product_data(product)
    image_items = []
    if product.image:
        image_items.append({'key': 'primary', 'url': product.image.url})
    image_items.extend({'key': f'gallery:{image.id}', 'url': image.image.url} for image in product.gallery_images.all())
    data.update({
        'image_url': product.image_url,
        'images': data['images'],
        'image_items': image_items,
        'is_active': product.is_active,
        'is_featured': product.is_featured,
        'created_at': product.created_at.isoformat(),
        'stock': sum(variant.stock_quantity for variant in product.variants.all()),
        'skus': list(product.variants.values('id', 'size', 'sku', 'stock_quantity')),
    })
    return data


def admin_product_payload(request, product=None):
    data = request.data
    name = data.get('name', product.name if product else '').strip()
    category_value = data.get('category', product.category_id if product else '')
    category = Category.objects.filter(id=category_value).first() if str(category_value).isdigit() else Category.objects.filter(name__iexact=category_value).first()
    if not name or not category:
        return None, 'Product name and a valid category are required.'
    slug = slugify(data.get('slug') or name)
    if Product.objects.filter(slug=slug).exclude(id=product.id if product else None).exists():
        slug = f'{slug}-{Product.objects.count() + 1}'
    values = {
        'name': name,
        'slug': slug,
        'brand': data.get('brand', 'HUMBELL').strip(),
        'description': data.get('description', '').strip(),
        'color': data.get('color', '').strip(),
        'price': data.get('price', 0),
        'compare_at_price': data.get('compare_at_price') or None,
        'image_url': data.get('image_url', product.image_url if product else '').strip(),
        'category': category,
        'tag': data.get('tag', '').strip(),
        'is_active': str(data.get('is_active', True)).lower() not in {'false', '0', 'no'},
        'is_featured': str(data.get('is_featured', False)).lower() in {'true', '1', 'yes'},
    }
    return values, None


def admin_product_sizes_and_stock(request, fallback_sizes=None):
    raw_sizes = request.data.get('sizes')
    if raw_sizes is None:
        raw_sizes = ','.join(fallback_sizes or ['S', 'M', 'L', 'XL', 'XXL'])
    sizes = list(dict.fromkeys(size.strip().upper() for size in str(raw_sizes).split(',') if size.strip()))
    if not sizes:
        return None, None, 'Add at least one product size.'
    if any(len(size) > 10 for size in sizes):
        return None, None, 'Each size must be 10 characters or fewer.'
    raw_inventory = request.data.get('stock_by_size')
    if raw_inventory is None:
        try:
            quantity = int(request.data.get('stock_quantity', 0))
            if quantity < 0:
                raise ValueError
        except (TypeError, ValueError):
            return None, None, 'Stock quantities must be zero or greater.'
        return sizes, {size: quantity for size in sizes}, None
    try:
        inventory = json.loads(raw_inventory) if isinstance(raw_inventory, str) else raw_inventory
    except (TypeError, ValueError):
        return None, None, 'Inventory by size must be valid JSON.'
    if not isinstance(inventory, dict):
        return None, None, 'Inventory by size must be a size-to-quantity map.'
    normalized = {str(size).strip().upper(): quantity for size, quantity in inventory.items()}
    if set(normalized) != set(sizes):
        return None, None, 'Enter a stock quantity for every selected size.'
    try:
        quantities = {}
        for size, quantity in normalized.items():
            if isinstance(quantity, bool) or not str(quantity).strip().isdigit():
                raise ValueError
            quantities[size] = int(quantity)
    except (TypeError, ValueError):
        return None, None, 'Stock quantities must be whole numbers of zero or greater.'
    return sizes, quantities, None


@api_view(['GET', 'POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_product_list(request):
    if request.method == 'GET':
        products = Product.objects.select_related('category').prefetch_related('variants', 'gallery_images').order_by('-created_at')
        return JsonResponse({'results': [admin_product_data(product) for product in products]})
    values, error = admin_product_payload(request)
    if error:
        return JsonResponse({'detail': error}, status=400)
    sizes, stock_by_size, error = admin_product_sizes_and_stock(request)
    if error:
        return JsonResponse({'detail': error}, status=400)
    try:
        image_order = request.data.get('image_order')
        image_order = json.loads(image_order) if isinstance(image_order, str) else image_order
        if image_order is not None and (not isinstance(image_order, list) or any(not isinstance(key, str) for key in image_order)):
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({'detail': 'Image order must be a list of image keys.'}, status=400)
    with transaction.atomic():
        product = Product.objects.create(**values)
        for size in sizes:
            ProductVariant.objects.create(product=product, size=size, sku=f'{product.slug.upper()}-{size}', stock_quantity=stock_by_size[size])
    if request.FILES.get('image'):
        product.image = request.FILES['image']
        product.save(update_fields=['image', 'updated_at'])
    uploaded = [ProductImage.objects.create(product=product, image=upload, position=position) for position, upload in enumerate(request.FILES.getlist('images'))]
    if image_order is not None:
        ordered = [uploaded[int(key[7:])] for key in image_order if key.startswith('upload:') and key[7:].isdigit() and int(key[7:]) < len(uploaded)]
        if ordered:
            cover = ordered.pop(0)
            product.image.name = cover.image.name
            product.save(update_fields=['image', 'updated_at'])
            cover.delete()
        for position, image in enumerate(ordered):
            image.position = position
            image.save(update_fields=['position', 'updated_at'])
        ordered_ids = [image.id for image in ordered]
        for image in product.gallery_images.exclude(id__in=ordered_ids):
            default_storage.delete(image.image.name)
            image.delete()
    return JsonResponse(admin_product_data(product), status=201)


@api_view(['PATCH', 'DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_product_detail(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    if request.method == 'DELETE':
        if product.image:
            default_storage.delete(product.image.name)
        for gallery_image in product.gallery_images.all():
            default_storage.delete(gallery_image.image.name)
        product.delete()
        return JsonResponse({'detail': 'Product deleted.'})
    values, error = admin_product_payload(request, product)
    if error:
        return JsonResponse({'detail': error}, status=400)
    sizes, stock_by_size, error = admin_product_sizes_and_stock(request, list(product.variants.values_list('size', flat=True)))
    if error:
        return JsonResponse({'detail': error}, status=400)
    try:
        image_order = request.data.get('image_order')
        image_order = json.loads(image_order) if isinstance(image_order, str) else image_order
        if image_order is not None and (not isinstance(image_order, list) or any(not isinstance(key, str) for key in image_order)):
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({'detail': 'Image order must be a list of image keys.'}, status=400)
    for field, value in values.items():
        setattr(product, field, value)
    if request.FILES.get('image'):
        product.image = request.FILES['image']
    product.save()
    uploaded = []
    for upload in request.FILES.getlist('images'):
        uploaded.append(ProductImage.objects.create(product=product, image=upload, position=product.gallery_images.count()))
    if image_order is not None:
        if 'primary' not in image_order and product.image:
            default_storage.delete(product.image.name)
            product.image = None
            product.save(update_fields=['image', 'updated_at'])
        resolved_order = []
        for key in image_order:
            if key == 'primary' and product.image:
                resolved_order.append(('primary', None))
            elif key == 'external' and product.image_url:
                resolved_order.append(('external', None))
            elif key.startswith('gallery:') and key[8:].isdigit():
                image = product.gallery_images.filter(id=int(key[8:])).first()
                if image:
                    resolved_order.append(('gallery', image))
            elif key.startswith('upload:') and key[7:].isdigit() and int(key[7:]) < len(uploaded):
                resolved_order.append(('gallery', uploaded[int(key[7:])]))
        promoted_old_primary = None
        if resolved_order and resolved_order[0][0] == 'gallery':
            cover = resolved_order.pop(0)[1]
            old_primary_name = product.image.name if product.image else ''
            new_primary_name = cover.image.name
            product.image.name = new_primary_name
            product.save(update_fields=['image', 'updated_at'])
            if old_primary_name:
                cover.image.name = old_primary_name
                cover.save(update_fields=['image', 'updated_at'])
                promoted_old_primary = cover
            else:
                cover.delete()
        elif not resolved_order or resolved_order[0][0] != 'primary':
            if product.image:
                default_storage.delete(product.image.name)
                product.image = None
                product.save(update_fields=['image', 'updated_at'])
        gallery_order = ([promoted_old_primary] if promoted_old_primary else []) + [image for kind, image in resolved_order if kind == 'gallery']
        retained_ids = [image.id for image in gallery_order]
        for image in product.gallery_images.exclude(id__in=retained_ids):
            default_storage.delete(image.image.name)
            image.delete()
        for position, image in enumerate(gallery_order):
            if image.position != position:
                image.position = position
                image.save(update_fields=['position', 'updated_at'])
    product.variants.exclude(size__in=sizes).delete()
    for size in sizes:
        variant, _ = ProductVariant.objects.get_or_create(product=product, size=size, defaults={'sku': f'{product.slug.upper()}-{size}'})
        variant.stock_quantity = stock_by_size[size]
        variant.save(update_fields=['stock_quantity', 'updated_at'])
    return JsonResponse(admin_product_data(product))


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_summary(request):
    orders = Order.objects.select_related('customer__user').order_by('-created_at')
    return JsonResponse({
        'products': Product.objects.filter(is_active=True).count(),
        'customers': CustomerProfile.objects.count(),
        'orders': orders.count(),
        'pending_orders': orders.filter(status__in=['pending', 'confirmed', 'processing']).count(),
        'sales': str(sum(order.total for order in orders)),
        'recent_orders': [
            {'order_number': order.order_number, 'customer': order.customer.user.get_full_name(), 'status': order.status, 'total': str(order.total), 'created_at': order.created_at.isoformat()}
            for order in orders[:5]
        ],
    })


def order_data(order):
    return {
        'id': order.id,
        'order_number': order.order_number,
        'status': order.status,
        'payment_status': order.payment_status,
        'payment_method': 'cod' if order.payment_reference == 'COD' else 'razorpay',
        'created_at': order.created_at.isoformat(),
        'total': str(order.total),
        'address': {'full_name': order.address.full_name, 'phone': order.address.phone, 'line1': order.address.line1, 'line2': order.address.line2, 'city': order.address.city, 'state': order.address.state, 'pincode': order.address.pincode},
        'items': [{'name': item.product.name, 'image': product_primary_image(item.product), 'quantity': item.quantity, 'size': item.variant.size, 'unit_price': str(item.unit_price)} for item in order.items.select_related('product', 'variant').all()],
    }


def product_primary_image(product):
    if product.image:
        return product.image.url
    gallery_image = next(iter(product.gallery_images.all()), None)
    if gallery_image:
        return gallery_image.image.url
    return product.image_url


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def order_list(request):
    orders = Order.objects.filter(customer__user=request.user).prefetch_related('items__product__gallery_images', 'items__variant')
    status = request.GET.get('status')
    if status and status != 'all':
        orders = orders.filter(status=status)
    return JsonResponse({'count': orders.count(), 'results': [order_data(order) for order in orders]})



@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_order_list(request):
    orders = Order.objects.select_related('customer__user', 'address').prefetch_related('items__product__gallery_images', 'items__variant')
    results = []
    for order in orders:
        data = order_data(order)
        data['customer'] = order.customer.user.get_full_name() or order.customer.user.email
        data['email'] = order.customer.user.email
        results.append(data)
    return JsonResponse({'count': len(results), 'results': results})


class InsufficientStock(Exception):
    pass


def deduct_order_stock(order):
    if order.stock_deducted:
        return
    quantities = defaultdict(int)
    for item in OrderItem.objects.filter(order=order).values('variant_id', 'quantity'):
        quantities[item['variant_id']] += item['quantity']
    for variant_id, quantity in quantities.items():
        variant = ProductVariant.objects.select_for_update().select_related('product').get(id=variant_id)
        if variant.stock_quantity < quantity:
            raise InsufficientStock(f'Not enough stock for {variant.product.name} ({variant.size}).')
        variant.stock_quantity -= quantity
        variant.save(update_fields=['stock_quantity', 'updated_at'])
    order.stock_deducted = True


def restore_order_stock(order):
    if not order.stock_deducted:
        return
    quantities = defaultdict(int)
    for item in OrderItem.objects.filter(order=order).values('variant_id', 'quantity'):
        quantities[item['variant_id']] += item['quantity']
    for variant_id, quantity in quantities.items():
        variant = ProductVariant.objects.select_for_update().get(id=variant_id)
        variant.stock_quantity += quantity
        variant.save(update_fields=['stock_quantity', 'updated_at'])
    order.stock_deducted = False


@api_view(['PATCH'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_order_status_update(request, order_id):
    status = request.data.get('status')
    if status not in Order.Status.values:
        return JsonResponse({'detail': 'Choose a valid order status.'}, status=400)
    try:
        with transaction.atomic():
            order = get_object_or_404(Order.objects.select_for_update(), id=order_id)
            if status in {Order.Status.CONFIRMED, Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED}:
                deduct_order_stock(order)
            elif status == Order.Status.CANCELLED:
                restore_order_stock(order)
            order.status = status
            order.save(update_fields=['status', 'stock_deducted', 'updated_at'])
    except InsufficientStock as error:
        return JsonResponse({'detail': str(error)}, status=409)
    return JsonResponse({'id': order.id, 'order_number': order.order_number, 'status': order.status})


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_customer_list(request):
    customers = CustomerProfile.objects.select_related('user').annotate(
        order_count=Count('orders', distinct=True), total_spent=Sum('orders__total'),
    ).order_by('-created_at')
    return JsonResponse({'results': [
        {'id': customer.id, 'name': customer.user.get_full_name() or customer.user.email,
         'email': customer.user.email, 'phone': customer.phone, 'order_count': customer.order_count,
         'total_spent': str(customer.total_spent or Decimal('0.00')), 'joined_at': customer.created_at.isoformat()}
        for customer in customers
    ]})


def admin_ticket_data(ticket):
    return {
        'id': ticket.id, 'subject': ticket.subject, 'message': ticket.message,
        'status': ticket.status,
        'customer': (ticket.customer.user.get_full_name() or ticket.customer.user.email) if ticket.customer else 'Guest',
        'email': ticket.customer.user.email if ticket.customer else '',
        'created_at': ticket.created_at.isoformat(),
    }


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_support_tickets(request):
    tickets = SupportTicket.objects.select_related('customer__user').order_by('-created_at')
    return JsonResponse({'results': [admin_ticket_data(ticket) for ticket in tickets]})


@api_view(['PATCH'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_support_ticket_update(request, ticket_id):
    ticket = get_object_or_404(SupportTicket, id=ticket_id)
    status = str(request.data.get('status', '')).strip()
    if status not in {'open', 'in_progress', 'resolved', 'closed'}:
        return JsonResponse({'detail': 'Choose a valid support status.'}, status=400)
    ticket.status = status
    ticket.save(update_fields=['status', 'updated_at'])
    return JsonResponse(admin_ticket_data(ticket))


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_analytics(request):
    orders = Order.objects.all()
    paid_or_cod = orders.exclude(status=Order.Status.CANCELLED)
    online = paid_or_cod.exclude(payment_reference='COD')
    cod = paid_or_cod.filter(payment_reference='COD')
    daily = []
    for day in range(6, -1, -1):
        date = timezone.localdate() - timedelta(days=day)
        day_orders = paid_or_cod.filter(created_at__date=date)
        daily.append({'date': date.isoformat(), 'orders': day_orders.count(), 'sales': str(sum(item.total for item in day_orders))})
    return JsonResponse({
        'orders': orders.count(), 'gross_sales': str(sum(order.total for order in paid_or_cod)),
        'cod_orders': cod.count(), 'cod_sales': str(sum(order.total for order in cod)),
        'online_orders': online.count(), 'online_sales': str(sum(order.total for order in online)),
        'pending_orders': orders.filter(status=Order.Status.PENDING).count(),
        'statuses': [{'status': status, 'count': orders.filter(status=status).count()} for status, _ in Order.Status.choices],
        'daily_sales': daily,
    })


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperuser])
def admin_notifications(request):
    events = []
    for order in Order.objects.select_related('customer__user').order_by('-created_at')[:30]:
        name = order.customer.user.get_full_name() or order.customer.user.email
        method = 'Cash on delivery' if order.payment_reference == 'COD' else 'Razorpay'
        events.append({
            'id': f'order-{order.id}', 'kind': 'order', 'title': f'Order {order.order_number} placed',
            'detail': f'{name} ? {method} ? ?{order.total}', 'created_at': order.created_at.isoformat(),
            'url': '/admin/orders',
        })
    for ticket in SupportTicket.objects.order_by('-created_at')[:20]:
        events.append({
            'id': f'ticket-{ticket.id}', 'kind': 'support', 'title': ticket.subject,
            'detail': f'Support request ? {ticket.status}', 'created_at': ticket.created_at.isoformat(),
            'url': '/admin/support',
        })
    events.sort(key=lambda event: event['created_at'], reverse=True)
    return JsonResponse({'count': len(events), 'results': events[:40]})



def cart_item_data(item):
    product = product_data(item.variant.product)
    return {'id': item.id, 'quantity': item.quantity, 'variant_id': item.variant_id, 'size': item.variant.size, 'product': product}


@api_view(['GET', 'POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def cart_list(request):
    cart, _ = Cart.objects.get_or_create(customer=profile_for(request.user))
    if request.method == 'POST':
        variant = get_object_or_404(ProductVariant, id=request.data.get('variant_id'), product__is_active=True)
        quantity = max(1, int(request.data.get('quantity', 1)))
        item, created = cart.items.get_or_create(variant=variant, defaults={'quantity': quantity})
        if not created:
            item.quantity = quantity
            item.save(update_fields=['quantity', 'updated_at'])
    return JsonResponse({'results': [cart_item_data(item) for item in cart.items.select_related('variant__product').all()]})


@api_view(['PATCH', 'DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def cart_item_detail(request, item_id):
    item = get_object_or_404(CartItem, id=item_id, cart__customer__user=request.user)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'detail': 'Cart item removed.'})
    item.quantity = max(1, int(request.data.get('quantity', item.quantity)))
    item.save(update_fields=['quantity', 'updated_at'])
    return JsonResponse(cart_item_data(item))


@api_view(['GET', 'POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def wishlist_list(request):
    profile = profile_for(request.user)
    if request.method == 'POST':
        product = get_object_or_404(Product, id=request.data.get('product_id'), is_active=True)
        WishlistItem.objects.get_or_create(customer=profile, product=product)
    return JsonResponse({'results': [product_data(item.product) for item in profile.wishlist_items.select_related('product__category').all()]})


@api_view(['DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def wishlist_detail(request, product_id):
    item = get_object_or_404(WishlistItem, customer__user=request.user, product_id=product_id)
    item.delete()
    return JsonResponse({'detail': 'Wishlist item removed.'})


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def support_ticket_create(request):
    subject = request.data.get('subject', '').strip()
    message = request.data.get('message', '').strip()
    if not subject or not message:
        return JsonResponse({'detail': 'Subject and message are required.'}, status=400)
    ticket = profile_for(request.user).support_tickets.create(subject=subject, message=message)
    return JsonResponse({'id': ticket.id, 'status': ticket.status}, status=201)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def create_payment_order(request):
    profile = profile_for(request.user)
    cart = Cart.objects.filter(customer=profile).first()
    items = list(cart.items.select_related('variant__product').all()) if cart else []
    address_id = request.data.get('address_id')
    address = profile.addresses.filter(id=address_id).first() if address_id else None
    if address_id and not address:
        return JsonResponse({'detail': 'Choose a valid delivery address.'}, status=400)
    address = address or profile.addresses.filter(is_default=True).first() or profile.addresses.first()
    if not items:
        return JsonResponse({'detail': 'Your cart is empty.'}, status=400)
    if not address:
        return JsonResponse({'detail': 'Add a delivery address before payment.'}, status=400)
    for item in items:
        if item.variant.stock_quantity < item.quantity:
            return JsonResponse({'detail': f'Not enough stock for {item.variant.product.name} ({item.variant.size}).'}, status=409)
    subtotal = sum((item.variant.product.price * item.quantity for item in items), Decimal('0'))
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_SECRET:
        return JsonResponse({'detail': 'Razorpay is not configured on the backend.'}, status=503)
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_SECRET))
    try:
        payment_order = client.order.create({
            'amount': int(subtotal * 100), 'currency': 'INR',
            'receipt': f'humbell-{request.user.id}-{secrets.token_hex(8)}', 'payment_capture': 1,
        })
    except Exception:
        logger.exception('Razorpay order creation failed.')
        return JsonResponse({'detail': 'Razorpay could not create a payment order. Please try again.'}, status=502)
    with transaction.atomic():
        order = Order.objects.create(
            customer=profile, address=address,
            order_number=f'HBL-{int(time.time())}-{request.user.id}-{secrets.token_hex(2).upper()}',
            subtotal=subtotal, total=subtotal, payment_reference=payment_order['id'],
        )
        OrderItem.objects.bulk_create([
            OrderItem(order=order, product=item.variant.product, variant=item.variant,
                      quantity=item.quantity, unit_price=item.variant.product.price)
            for item in items
        ])
    return JsonResponse({
        'id': payment_order['id'], 'amount': payment_order['amount'],
        'currency': payment_order['currency'], 'key_id': settings.RAZORPAY_KEY_ID,
        'order_number': order.order_number,
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    required = ('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature')
    if any(not request.data.get(field) for field in required):
        return JsonResponse({'detail': 'Incomplete Razorpay payment response.'}, status=400)
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_SECRET:
        return JsonResponse({'detail': 'Razorpay is not configured on the backend.'}, status=503)
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_SECRET))
    try:
        client.utility.verify_payment_signature({field: request.data[field] for field in required})
    except razorpay.errors.SignatureVerificationError:
        return JsonResponse({'detail': 'Payment signature verification failed.'}, status=400)
    except Exception:
        logger.exception('Razorpay signature verification unavailable.')
        return JsonResponse({'detail': 'Unable to verify payment with Razorpay right now.'}, status=502)
    order = get_object_or_404(
        Order, payment_reference=request.data['razorpay_order_id'], customer__user=request.user,
    )
    try:
        payment = client.payment.fetch(request.data['razorpay_payment_id'])
        amount = int(payment.get('amount', 0))
    except Exception:
        logger.exception('Razorpay payment lookup failed.')
        return JsonResponse({'detail': 'Unable to confirm payment status with Razorpay right now.'}, status=502)
    if (payment.get('order_id') != request.data['razorpay_order_id']
            or amount != int(order.total * 100) or payment.get('status') != 'captured'):
        return JsonResponse({'detail': 'Payment is not captured for this order and amount.'}, status=409)
    try:
        with transaction.atomic():
            order = get_object_or_404(Order.objects.select_for_update(), id=order.id)
            deduct_order_stock(order)
            order.payment_status = 'paid'
            order.payment_reference = request.data['razorpay_payment_id']
            order.status = Order.Status.CONFIRMED
            order.save(update_fields=['payment_status', 'payment_reference', 'status', 'stock_deducted', 'updated_at'])
    except InsufficientStock:
        payment_id = request.data['razorpay_payment_id']
        try:
            client.payment.refund(payment_id, int(order.total * 100))
        except Exception:
            order.payment_reference = payment_id
            order.payment_status = 'refund_pending'
            order.save(update_fields=['payment_reference', 'payment_status', 'updated_at'])
            return JsonResponse({'detail': 'Payment received but inventory ran out. Your refund is pending review.'}, status=503)
        order.payment_reference = payment_id
        order.payment_status = 'refunded'
        order.status = Order.Status.CANCELLED
        order.save(update_fields=['payment_reference', 'payment_status', 'status', 'updated_at'])
        return JsonResponse({'detail': 'Inventory ran out. Razorpay has been asked to refund your payment.'}, status=409)
    CartItem.objects.filter(cart__customer__user=request.user).delete()
    return JsonResponse({'verified': True, 'payment_id': request.data['razorpay_payment_id'], 'order_number': order.order_number})


def json_body(request):
    try:
        return json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return None


def profile_for(user):
    profile, _ = CustomerProfile.objects.get_or_create(user=user)
    return profile


def address_data(address):
    return {
        'id': address.id,
        'full_name': address.full_name,
        'phone': address.phone,
        'line1': address.line1,
        'line2': address.line2,
        'city': address.city,
        'state': address.state,
        'pincode': address.pincode,
        'landmark': address.landmark,
        'is_default': address.is_default,
    }


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_scope('signup_otp')
def send_signup_otp(request):
    email = str(request.data.get('email', '')).strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'detail': 'Enter a valid email address.'}, status=400)
    User = get_user_model()
    if User.objects.filter(username=email).exists():
        return JsonResponse({'detail': 'An account with this email already exists.'}, status=409)
    if not getattr(settings, 'EMAIL_HOST', ''):
        return JsonResponse({'detail': 'Email verification is not configured on the server.'}, status=503)
    recent = SignupVerification.objects.filter(email=email, created_at__gte=timezone.now() - timedelta(seconds=60)).exists()
    if recent:
        return JsonResponse({'detail': 'Please wait before requesting another code.'}, status=429)
    code = f'{secrets.randbelow(1000000):06d}'
    SignupVerification.objects.filter(email=email).delete()
    SignupVerification.objects.create(email=email, code_hash=make_password(code), expires_at=timezone.now() + timedelta(minutes=10))
    try:
        send_mail('Your HUMBELL verification code', f'Your verification code is {code}. It expires in 10 minutes.', settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
    except Exception as exc:
        logger.warning('Signup verification email failed: %s', type(exc).__name__)
        SignupVerification.objects.filter(email=email).delete()
        return JsonResponse({'detail': 'We could not send the verification email. Check the SMTP settings and try again.'}, status=503)
    return JsonResponse({'detail': 'Verification code sent.'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_scope('signup')
def signup(request):
    data = request.data
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or len(password) < 8:
        return JsonResponse({'detail': 'Email and a password of at least 8 characters are required.'}, status=400)
    User = get_user_model()
    if User.objects.filter(username=email).exists():
        return JsonResponse({'detail': 'An account with this email already exists.'}, status=409)
    code = str(data.get('otp', data.get('code', ''))).strip()
    verification = SignupVerification.objects.filter(email=email).order_by('-created_at').first()
    if not verification or not verification.expires_at or verification.expires_at <= timezone.now() or not code or not check_password(code, verification.code_hash):
        return JsonResponse({'detail': 'Enter a valid, unexpired email verification code.'}, status=400)
    user = User.objects.create_user(username=email, email=email, password=password, first_name=data.get('full_name', '').strip())
    profile = profile_for(user)
    profile.phone = data.get('phone', '').strip()
    profile.save(update_fields=['phone', 'updated_at'])
    token = Token.objects.create(user=user)
    SignupVerification.objects.filter(email=email).delete()
    return JsonResponse({'token': token.key, 'user': {'id': user.id, 'name': user.get_full_name(), 'email': user.email}}, status=201)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_scope('login')
def login(request):
    email = request.data.get('email', '').strip().lower()
    user = authenticate(username=email, password=request.data.get('password', ''))
    if not user:
        return JsonResponse({'detail': 'Invalid email or password.'}, status=401)
    token, _ = Token.objects.get_or_create(user=user)
    return JsonResponse({'token': token.key, 'user': {'id': user.id, 'name': user.get_full_name(), 'email': user.email}})


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return JsonResponse({'detail': 'Signed out.'})


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    profile = profile_for(request.user)
    return JsonResponse({'id': request.user.id, 'name': request.user.get_full_name(), 'email': request.user.email, 'phone': profile.phone, 'is_superuser': request.user.is_superuser})


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def change_password(request):
    current = request.data.get('current_password', '')
    new = request.data.get('new_password', '')
    if not request.user.check_password(current):
        return JsonResponse({'detail': 'Current password is incorrect.'}, status=400)
    try:
        password_validation.validate_password(new, request.user)
    except ValidationError as exc:
        return JsonResponse({'detail': ' '.join(exc.messages)}, status=400)
    request.user.set_password(new)
    request.user.save(update_fields=['password'])
    return JsonResponse({'detail': 'Password changed successfully.'})


@api_view(['GET', 'POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def address_list(request):
    profile = profile_for(request.user)
    if request.method == 'GET':
        return JsonResponse({'results': [address_data(address) for address in profile.addresses.all()]})
    data = request.data
    required = ('full_name', 'phone', 'line1', 'city', 'state', 'pincode')
    if any(not data.get(field) for field in required):
        return JsonResponse({'detail': 'All required address fields must be provided.'}, status=400)
    if data.get('is_default'):
        profile.addresses.update(is_default=False)
    address = profile.addresses.create(**{field: data.get(field, False if field == 'is_default' else '') for field in ('full_name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'landmark', 'is_default')})
    return JsonResponse(address_data(address), status=201)


@api_view(['PUT', 'PATCH', 'DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def address_detail(request, address_id):
    address = get_object_or_404(Address, id=address_id, customer__user=request.user)
    if request.method == 'DELETE':
        address.delete()
        return JsonResponse({'detail': 'Address deleted.'})
    data = request.data
    if data.get('is_default'):
        address.customer.addresses.exclude(id=address.id).update(is_default=False)
    for field in ('full_name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'landmark', 'is_default'):
        if field in data:
            setattr(address, field, data[field])
    address.save()
    return JsonResponse(address_data(address))


@csrf_exempt
@require_http_methods(['POST'])
def newsletter_subscribe(request):
    return JsonResponse({'detail': 'Subscription endpoint is ready for persistence.'}, status=201)
