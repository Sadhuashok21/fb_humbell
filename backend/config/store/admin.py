from django.contrib import admin

from .models import (
    Address,
    Cart,
    CartItem,
    Category,
    CustomerProfile,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    SupportTicket,
    WishlistItem,
)

admin.site.register([
    Address,
    Cart,
    CartItem,
    Category,
    CustomerProfile,
    Order,
    OrderItem,
    Product,
    ProductVariant,
    SupportTicket,
    WishlistItem,
])