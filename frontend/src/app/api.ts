const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8000/api" : "")).replace(/\/$/, "");
const BACKEND_URL = API_URL.replace(/\/api$/, "");

export type Address = {
  id: number;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  is_default: boolean;
};

export type AuthUser = { id: number; name: string; email: string; phone?: string; is_superuser?: boolean };
export type AdminProduct = { id: number; slug: string; name: string; brand: string; description: string; price: string; compare_at_price: string | null; image: string; images: string[]; image_items: { key: string; url: string }[]; image_url: string; category: string; tag: string; is_active: boolean; stock: number; skus: { id: number; size: string; sku: string; stock_quantity: number }[] };
export type StoreProduct = { id: number; slug: string; name: string; brand: string; price: number; old: number; image: string; images: string[]; color: string; tag: string; description: string; category: string; variants: { id: number; size: string; sku: string; stock_quantity: number }[] };
export type AdminSummary = { products: number; customers: number; orders: number; pending_orders: number; sales: string; recent_orders: { order_number: string; customer: string; status: string; total: string; created_at: string }[] };
export type UserOrder = { id: number; order_number: string; status: string; payment_status: string; payment_method: "cod" | "razorpay"; created_at: string; total: string; address: { full_name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string }; items: { name: string; image: string; quantity: number; size: string; unit_price: string }[] };
export type AdminOrder = UserOrder & { customer: string; email: string };
export type AdminCustomer = { id: number; name: string; email: string; phone: string; order_count: number; total_spent: string; joined_at: string };
export type AdminTicket = { id: number; subject: string; message: string; status: string; customer: string; email: string; created_at: string };
export type AdminAnalytics = { orders: number; gross_sales: string; cod_orders: number; cod_sales: string; online_orders: number; online_sales: string; pending_orders: number; statuses: { status: string; count: number }[]; daily_sales: { date: string; orders: number; sales: string }[] };
export type AdminNotification = { id: string; kind: string; title: string; detail: string; created_at: string; url: string };
export type ProductFilters = { categories: { name: string; slug: string }[]; brands: string[]; sizes: string[]; colors: string[]; price: { min: string | number; max: string | number } };
export type PaymentOrder = { id: string; amount: number; currency: string; key_id: string };
export type CartItem = { id: number; quantity: number; variant_id: number; size: string; product: StoreProduct };

async function request<T>(path: string, options: RequestInit = {}, includeAuth = true): Promise<T> {
  if (!API_URL) throw new Error("The production API URL is not configured. Set VITE_API_URL and rebuild the frontend.");
  const token = includeAuth ? localStorage.getItem("humbell_token") : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (includeAuth && response.status === 401 && /invalid token|authentication credentials/i.test(String(payload.detail || ""))) localStorage.removeItem("humbell_token");
    throw new Error(payload.detail || "Something went wrong");
  }
  return payload as T;
}

async function uploadRequest<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  if (!API_URL) throw new Error("The production API URL is not configured. Set VITE_API_URL and rebuild the frontend.");
  const token = localStorage.getItem("humbell_token");
  const response = await fetch(`${API_URL}${path}`, { method, body: form, headers: token ? { Authorization: `Token ${token}` } : {} });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && /invalid token|authentication credentials/i.test(String(payload.detail || ""))) localStorage.removeItem("humbell_token");
    throw new Error(payload.detail || "Something went wrong");
  }
  return payload as T;
}

export async function signIn(email: string, password: string) {
  const result = await request<{ token: string; user: AuthUser }>("/auth/login/", { method: "POST", body: JSON.stringify({ email, password }) }, false);
  localStorage.setItem("humbell_token", result.token);
  return result.user;
}

export const sendSignupOtp = (name: string, email: string, password: string) =>
  request<{ detail: string }>("/auth/signup/send-otp/", { method: "POST", body: JSON.stringify({ full_name: name, email, password }) }, false);

export async function signUp(name: string, email: string, phone: string, password: string, otp: string) {
  const result = await request<{ token: string; user: AuthUser }>("/auth/signup/", { method: "POST", body: JSON.stringify({ full_name: name, email, phone, password, otp }) }, false);
  localStorage.setItem("humbell_token", result.token);
  return result.user;
}

export const getCurrentUser = () => request<AuthUser>("/auth/me/");
export const changePassword = (current_password: string, new_password: string, confirm_password: string) =>
  request<{ detail: string }>("/auth/change-password/", { method: "POST", body: JSON.stringify({ current_password, new_password, confirm_password }) });

const normalizeProduct = (product: Omit<StoreProduct, "price" | "old" | "image" | "images"> & { price: string; compare_at_price: string | null; image: string; images?: string[] }) => ({
  ...product,
  price: Number(product.price),
  old: Number(product.compare_at_price || product.price),
  image: normalizeImage(product.image),
  images: (product.images?.length ? product.images : [product.image]).map(normalizeImage).filter(Boolean),
});

const normalizeImage = (image: string | null | undefined) => {
  if (!image) return "";
  if (/^(https?:)?\/\//i.test(image) || image.startsWith("data:")) return image;
  return `${BACKEND_URL}/${image.replace(/^\/+/, "")}`;
};

export async function getProducts(filters: Record<string, string | number> = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => String(value).length).map(([key, value]) => [key, String(value)]));
  const result = await request<{ results: Parameters<typeof normalizeProduct>[0][] }>(`/products/${query.toString() ? `?${query}` : ""}`);
  return result.results.map(normalizeProduct);
}

export const getProductFilters = () => request<ProductFilters>("/products/filters/");

export async function getProduct(slug: string) {
  const result = await request<Parameters<typeof normalizeProduct>[0]>(`/products/${encodeURIComponent(slug)}/`);
  return normalizeProduct(result);
}

export function signOut() {
  return request<{ detail: string }>("/auth/logout/", { method: "POST" }).catch(() => undefined).finally(() => localStorage.removeItem("humbell_token"));
}

export const getAddresses = () => request<{ results: Address[] }>("/addresses/");
export const createAddress = (address: Omit<Address, "id">) => request<Address>("/addresses/", { method: "POST", body: JSON.stringify(address) });
export const updateAddress = (id: number, address: Partial<Address>) => request<Address>(`/addresses/${id}/`, { method: "PATCH", body: JSON.stringify(address) });
export const deleteAddress = (id: number) => request<{ detail: string }>(`/addresses/${id}/`, { method: "DELETE" });
export async function getAdminProducts() {
  const result = await request<{ results: AdminProduct[] }>("/admin/products/");
  return { results: result.results.map(normalizeAdminProduct) };
}
const normalizeAdminProduct = (product: AdminProduct) => ({ ...product, image: normalizeImage(product.image), images: (product.images?.length ? product.images : [product.image]).map(normalizeImage).filter(Boolean), image_items: (product.image_items || []).map((item) => ({ ...item, url: normalizeImage(item.url) })) });
export const createAdminProduct = async (form: FormData) => normalizeAdminProduct(await uploadRequest<AdminProduct>("/admin/products/", form));
export const updateAdminProduct = async (id: number, form: FormData) => normalizeAdminProduct(await uploadRequest<AdminProduct>(`/admin/products/${id}/`, form, "PATCH"));
export const deleteAdminProduct = (id: number) => request<{ detail: string }>(`/admin/products/${id}/`, { method: "DELETE" });
export const getAdminSummary = () => request<AdminSummary>("/admin/summary/");
const normalizeOrderImages = <T extends UserOrder>(order: T): T => ({ ...order, items: order.items.map((item) => ({ ...item, image: normalizeImage(item.image) })) });
export async function getOrders(status = "all") {
  const result = await request<{ count: number; results: UserOrder[] }>(`/orders/?status=${encodeURIComponent(status)}`);
  return { ...result, results: result.results.map(normalizeOrderImages) };
}
export async function getAdminOrders() {
  const result = await request<{ count: number; results: AdminOrder[] }>("/admin/orders/");
  return { ...result, results: result.results.map(normalizeOrderImages) };
}
export const updateAdminOrderStatus = (id: number, status: string) => request<{ id: number; order_number: string; status: string }>(`/admin/orders/${id}/`, { method: "PATCH", body: JSON.stringify({ status }) });
export const getAdminCustomers = () => request<{ results: AdminCustomer[] }>("/admin/customers/");
export const getAdminTickets = () => request<{ results: AdminTicket[] }>("/admin/support/");
export const updateAdminTicket = (id: number, status: string) => request<AdminTicket>(`/admin/support/${id}/`, { method: "PATCH", body: JSON.stringify({ status }) });
export const getAdminAnalytics = () => request<AdminAnalytics>("/admin/analytics/");
export const getAdminNotifications = () => request<{ count: number; results: AdminNotification[] }>("/admin/notifications/");
export async function getCart() { const result = await request<{ results: (Omit<CartItem, "product"> & { product: Parameters<typeof normalizeProduct>[0] })[] }>("/cart/"); return { results: result.results.map((item) => ({ ...item, product: normalizeProduct(item.product) })) }; }
export async function addToCart(variantId: number, quantity = 1) { const result = await request<{ results: (Omit<CartItem, "product"> & { product: Parameters<typeof normalizeProduct>[0] })[] }>("/cart/", { method: "POST", body: JSON.stringify({ variant_id: variantId, quantity }) }); return { results: result.results.map((item) => ({ ...item, product: normalizeProduct(item.product) })) }; }
export const updateCartItem = (id: number, quantity: number) => request<CartItem>(`/cart/${id}/`, { method: "PATCH", body: JSON.stringify({ quantity }) });
export const removeCartItem = (id: number) => request<{ detail: string }>(`/cart/${id}/`, { method: "DELETE" });
export async function getWishlist() { const result = await request<{ results: Parameters<typeof normalizeProduct>[0][] }>("/wishlist/"); return { results: result.results.map(normalizeProduct) }; }
export async function addToWishlist(productId: number) { const result = await request<{ results: Parameters<typeof normalizeProduct>[0][] }>("/wishlist/", { method: "POST", body: JSON.stringify({ product_id: productId }) }); return { results: result.results.map(normalizeProduct) }; }
export const removeFromWishlist = (productId: number) => request<{ detail: string }>(`/wishlist/${productId}/`, { method: "DELETE" });
export const createSupportTicket = (subject: string, message: string) => request<{ id: number; status: string }>("/support/tickets/", { method: "POST", body: JSON.stringify({ subject, message }) });
export const createPaymentOrder = (addressId: number) => request<PaymentOrder>("/payments/create-order/", { method: "POST", body: JSON.stringify({ address_id: addressId }) });
export const verifyPayment = (payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => request<{ verified: boolean; order_number: string }>("/payments/verify/", { method: "POST", body: JSON.stringify(payload) });
