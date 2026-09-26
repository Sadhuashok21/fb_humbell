from decimal import Decimal
import json
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from store.models import Address, Cart, CartItem, Category, CustomerProfile, Order, Product, ProductVariant


class CheckoutAndAdminProductionTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.customer_user = user_model.objects.create_user(
            username='buyer@example.test', email='buyer@example.test', password='Strong-password-123!'
        )
        self.customer = CustomerProfile.objects.create(user=self.customer_user)
        self.admin_user = user_model.objects.create_superuser(
            username='root@example.test', email='root@example.test', password='Strong-password-123!'
        )
        self.staff_user = user_model.objects.create_user(
            username='staff@example.test', email='staff@example.test', password='Strong-password-123!', is_staff=True
        )
        self.category = Category.objects.create(name='Test Apparel', slug='test-apparel')
        self.product = Product.objects.create(
            name='Classic shirt', slug='classic-shirt', category=self.category, price=Decimal('25.00')
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, size='M', sku='TEST-SHIRT-M', stock_quantity=4
        )
        self.address = Address.objects.create(
            customer=self.customer, full_name='Buyer', phone='5551234', line1='1 Main St',
            city='Springfield', state='CA', pincode='90000', is_default=True,
        )
        self.cart = Cart.objects.create(customer=self.customer)
        CartItem.objects.create(cart=self.cart, variant=self.variant, quantity=2)
        self.client = APIClient()

    def test_customer_can_place_cod_order_and_stock_deducts_when_staff_confirms(self):
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.post('/api/orders/cash-on-delivery/', {'address_id': self.address.id}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        order_number = json.loads(response.content)['order_number']
        order = Order.objects.get(order_number=order_number)
        self.assertEqual(order.payment_reference, 'COD')
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(self.variant.stock_quantity, 4)
        self.assertFalse(CartItem.objects.filter(cart=self.cart).exists())

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(f'/api/admin/orders/{order.id}/', {'status': 'confirmed'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.variant.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 2)
        self.assertTrue(order.stock_deducted)


    def _online_order(self):
        order = Order.objects.create(
            customer=self.customer, address=self.address, order_number='HBL-TEST-ONLINE',
            subtotal=Decimal('50.00'), total=Decimal('50.00'), payment_reference='order_gateway_123',
        )
        from store.models import OrderItem
        OrderItem.objects.create(
            order=order, product=self.product, variant=self.variant, quantity=2,
            unit_price=Decimal('25.00'),
        )
        return order

    def test_payment_verification_checks_captured_amount_before_deducting_stock(self):
        self._online_order()
        self.client.force_authenticate(user=self.customer_user)
        gateway = __import__('unittest.mock', fromlist=['Mock']).Mock()
        gateway.payment.fetch.return_value = {
            'order_id': 'order_gateway_123', 'amount': 100, 'status': 'captured',
        }
        with patch('store.views.razorpay.Client', return_value=gateway):
            response = self.client.post('/api/payments/verify/', {
                'razorpay_order_id': 'order_gateway_123',
                'razorpay_payment_id': 'pay_gateway_123',
                'razorpay_signature': 'signed-value',
            }, format='json')
        self.assertEqual(response.status_code, 409)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 4)

    def test_payment_verification_confirms_matching_captured_payment(self):
        order = self._online_order()
        self.client.force_authenticate(user=self.customer_user)
        gateway = __import__('unittest.mock', fromlist=['Mock']).Mock()
        gateway.payment.fetch.return_value = {
            'order_id': 'order_gateway_123', 'amount': 5000, 'status': 'captured',
        }
        with patch('store.views.razorpay.Client', return_value=gateway):
            response = self.client.post('/api/payments/verify/', {
                'razorpay_order_id': 'order_gateway_123',
                'razorpay_payment_id': 'pay_gateway_123',
                'razorpay_signature': 'signed-value',
            }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.variant.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 2)
        self.assertEqual(order.payment_status, 'paid')

    def test_non_superuser_cannot_read_admin_api_or_django_admin(self):
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.get('/api/admin/orders/')
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/api/admin/orders/')
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=None)
        self.client.force_login(self.staff_user)
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 403)
        self.assertIn(b'You are not allowed', response.content)

    def test_superuser_can_access_admin_api_and_django_admin(self):
        superuser = self.admin_user
        self.client.force_authenticate(user=superuser)
        response = self.client.get('/api/admin/orders/')
        self.assertEqual(response.status_code, 200, response.content)

        self.client.force_authenticate(user=None)
        self.client.force_login(superuser)
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 200)

    def test_checkout_rejects_insufficient_stock(self):
        CartItem.objects.filter(cart=self.cart).update(quantity=5)
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.post('/api/orders/cash-on-delivery/', {'address_id': self.address.id}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertFalse(Order.objects.exists())
