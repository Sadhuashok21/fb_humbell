from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(TimeStampedModel):
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True)
    brand = models.CharField(max_length=120, default='HUMBELL')
    description = models.TextField(blank=True)
    color = models.CharField(max_length=80, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    image_url = models.URLField(blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    tag = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ['-is_featured', '-created_at']

    def __str__(self):
        return self.name


class ProductImage(TimeStampedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to='products/gallery/')
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return f'{self.product.name} image {self.position + 1}'


class ProductVariant(TimeStampedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    size = models.CharField(max_length=10)
    sku = models.CharField(max_length=60, unique=True)
    stock_quantity = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['product', 'size'], name='unique_product_size')]

    def __str__(self):
        return f'{self.product.name} - {self.size}'


class CustomerProfile(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='customer_profile')
    phone = models.CharField(max_length=30, blank=True)


class SignupVerification(TimeStampedModel):
    email = models.EmailField(unique=True)
    code_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f'Signup verification for {self.email}'


class Address(TimeStampedModel):
    customer = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE, related_name='addresses')
    full_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=30)
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=20)
    landmark = models.CharField(max_length=160, blank=True)
    is_default = models.BooleanField(default=False)


class Cart(TimeStampedModel):
    customer = models.OneToOneField(CustomerProfile, on_delete=models.CASCADE, related_name='cart')


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name='cart_items')
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    class Meta:
        constraints = [models.UniqueConstraint(fields=['cart', 'variant'], name='unique_cart_variant')]


class WishlistItem(TimeStampedModel):
    customer = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE, related_name='wishlist_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='wishlist_items')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['customer', 'product'], name='unique_wishlist_product')]


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        PROCESSING = 'processing', 'Processing'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        CANCELLED = 'cancelled', 'Cancelled'

    customer = models.ForeignKey(CustomerProfile, on_delete=models.PROTECT, related_name='orders')
    address = models.ForeignKey(Address, on_delete=models.PROTECT, related_name='orders')
    order_number = models.CharField(max_length=30, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(max_length=30, default='pending')
    payment_reference = models.CharField(max_length=120, blank=True)
    stock_deducted = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)


class SupportTicket(TimeStampedModel):
    customer = models.ForeignKey(CustomerProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    subject = models.CharField(max_length=160)
    message = models.TextField()
    status = models.CharField(max_length=30, default='open')
