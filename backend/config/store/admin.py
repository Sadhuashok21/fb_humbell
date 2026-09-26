from django.contrib import admin
from django.http import HttpResponseForbidden

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

class SuperuserAdminSite(admin.AdminSite):
    """Django's built-in admin is limited to superusers for this storefront."""

    def has_permission(self, request):
        user = request.user
        return bool(user.is_active and user.is_superuser)

    def admin_view(self, view, cacheable=False):
        protected_view = super().admin_view(view, cacheable=cacheable)

        def superuser_only(request, *args, **kwargs):
            if request.user.is_authenticated and not request.user.is_superuser:
                return HttpResponseForbidden('You are not allowed to access the admin panel.')
            return protected_view(request, *args, **kwargs)

        return superuser_only


superuser_admin_site = SuperuserAdminSite(name='admin')
for model, model_admin in admin.site._registry.items():
    superuser_admin_site.register(model, model_admin.__class__)
