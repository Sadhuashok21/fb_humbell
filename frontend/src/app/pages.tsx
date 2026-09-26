import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Address, AdminProduct, AdminSummary, AuthUser, CartItem, ProductFilters, StoreProduct, addToCart, addToWishlist, createAdminProduct, createAddress, createPaymentOrder, createSupportTicket, deleteAdminProduct, deleteAddress, getAddresses, getAdminProducts, getAdminSummary, getCart, getCurrentUser, getOrders, getProductFilters, getProducts, getWishlist, removeCartItem, removeFromWishlist, signIn, signOut, signUp, sendSignupOtp, updateAddress, updateAdminProduct, updateCartItem, verifyPayment, changePassword } from "./api";
import { Seo } from "./seo";
import { AdminOrder, AdminCustomer, AdminTicket, AdminAnalytics, AdminNotification, getAdminOrders, updateAdminOrderStatus, getAdminCustomers, getAdminTickets, updateAdminTicket, getAdminAnalytics, getAdminNotifications } from "./api";
import { createCodOrder } from "./api";

const logo = `${import.meta.env.BASE_URL}humbell-logo.png`;

type PendingAuthAction = { type: "cart"; variantId: number; quantity: number; returnTo: string } | { type: "wishlist"; productId: number; returnTo: string };
function deferAuthAction(action: PendingAuthAction) { sessionStorage.setItem("humbell_pending_auth_action", JSON.stringify(action)); }
async function completePendingAuthAction(fallback: string) {
  const raw = sessionStorage.getItem("humbell_pending_auth_action");
  if (!raw) return fallback;
  const action = JSON.parse(raw) as PendingAuthAction;
  if (action.type === "cart") await addToCart(action.variantId, action.quantity);
  else await addToWishlist(action.productId);
  sessionStorage.removeItem("humbell_pending_auth_action");
  return action.returnTo.startsWith("/") && !action.returnTo.startsWith("//") ? action.returnTo : fallback;
}

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; } }

function useCatalog(filters: Record<string, string | number> = {}) {
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filterKey = JSON.stringify(filters);
  useEffect(() => { setLoading(true); setError(""); getProducts(filters).then(setCatalog).catch((requestError: Error) => setError(requestError.message)).finally(() => setLoading(false)); }, [filterKey]);
  return { catalog, loading, error };
}

function MiniIcon({ children }: { children: string }) {
  return <span className="mini-icon" aria-hidden="true">{children}</span>;
}

function StoreHeader() {
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const navigate = useNavigate();
  useEffect(() => { if (!localStorage.getItem("humbell_token")) return; getCurrentUser().then(setUser).catch(() => setUser(null)); }, []);
  useEffect(() => { if (!localStorage.getItem("humbell_token")) return; getCart().then((result) => setCartItems(result.results)).catch(() => setCartItems([])); }, []);
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  return (
    <>
      <div className="route-offer">EXTRA 10% OFF YOUR FIRST ORDER · USE HELLO10 <span>Free delivery over ₹999</span></div>
      <header className="route-header">
        <Link className="route-brand" to="/"><img src={logo} alt="Humbell logo" /><span>HUMBELL<small>WEAR YOUR STORY</small></span></Link>
        <form className="route-search" onSubmit={(event) => { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(search)}`); }}>
          <MiniIcon>⌕</MiniIcon><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search for shirts, fashion and more" /><button>Search</button>
        </form>
        <div className="route-actions">
          <Link to={user ? "/account" : "/signin"}><MiniIcon>○</MiniIcon><span>{user ? user.name : "Sign in"}<small>{user ? "Profile" : "Account"}</small></span></Link>
          <Link to="/wishlist"><MiniIcon>♡</MiniIcon><span>Saved<small>Wishlist</small></span></Link>
          <Link to="/cart" className="bag-link"><MiniIcon>□</MiniIcon><i>{cartCount}</i><span>Bag<small>{"\u20B9"}{cartTotal.toLocaleString("en-IN")}</small></span></Link>
        </div>
      </header>
      <nav className="route-nav">
        <Link to="/shop">Men</Link><Link to="/shop">Shirts</Link><Link to="/shop?sort=new">New Arrivals</Link><Link to="/shop?sort=best">Best Sellers</Link><Link className="sale" to="/shop?sale=true">Offers</Link><span /><Link to="/track-order">Track Order</Link><Link to="/support">Support</Link>
      </nav>
    </>
  );
}

function StoreFooter() {
  return <footer className="route-footer">
    <div><Link className="route-brand inverse" to="/"><img src={logo} alt="" /><span>HUMBELL<small>WEAR YOUR STORY</small></span></Link><p>Premium menswear for modern India.</p></div>
    <div><b>Shop</b><Link to="/shop">Shirts</Link><Link to="/shop?sort=new">New arrivals</Link><Link to="/wishlist">Wishlist</Link></div>
    <div><b>Customer service</b><Link to="/support">Help center</Link><Link to="/track-order">Track order</Link><Link to="/policies/returns">Returns & refunds</Link></div>
    <div><b>Company</b><Link to="/about">About Humbell</Link><Link to="/contact">Contact</Link><Link to="/policies/privacy">Privacy policy</Link></div>
    <div><b>Secure payments</b><p>Razorpay · UPI · Visa · Mastercard</p><small>© 2026 Humbell. All rights reserved.</small></div>
  </footer>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="route-site"><Seo /><StoreHeader />{children}<StoreFooter /><nav className="route-mobile-nav"><Link to="/">Home</Link><Link to="/search">Search</Link><Link to="/shop">Categories</Link><Link to="/cart">Cart</Link><Link to="/account">Profile</Link></nav></div>;
}

function CatalogCard({ item }: { item: StoreProduct }) {
  const [liked, setLiked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const toggleWishlist = async () => {
    if (!localStorage.getItem("humbell_token")) { deferAuthAction({ type: "wishlist", productId: item.id, returnTo: `/product/${item.slug}` }); return navigate("/signin"); }
    try { if (liked) await removeFromWishlist(item.id); else await addToWishlist(item.id); setLiked(!liked); } catch (error) { setMessage((error as Error).message); }
  };
  const handleAdd = async () => {
    const variant = item.variants[0];
    if (!variant) return setMessage("This product is currently unavailable.");
    if (!localStorage.getItem("humbell_token")) { deferAuthAction({ type: "cart", variantId: variant.id, quantity: 1, returnTo: "/cart" }); return navigate("/signin"); }
    setAdding(true); setMessage("");
    try { await addToCart(variant.id); navigate("/cart"); } catch (error) { setMessage((error as Error).message); } finally { setAdding(false); }
  };
  return <article className="catalog-card">
    <Link className="catalog-photo" to={`/product/${item.slug}`}><img src={item.image} alt={item.name} /><span>{item.tag}</span></Link>
    <button className={`catalog-heart ${liked ? "active" : ""}`} onClick={toggleWishlist}>♡</button>
    <div className="catalog-body"><small>{item.brand}</small><Link to={`/product/${item.slug}`}>{item.name}</Link><p><b>₹{item.price.toLocaleString("en-IN")}</b><del>₹{item.old.toLocaleString("en-IN")}</del><span>{Math.round((1 - item.price / item.old) * 100)}% off</span></p><small>{item.color} · S, M, L, XL, XXL</small><div className="catalog-actions"><button onClick={handleAdd} disabled={adding}>{adding ? "Adding..." : "Add to bag"}</button><Link to={`/product/${item.slug}`}>View product</Link></div>{message && <small role="alert">{message}</small>}</div>
  </article>;
}

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchQuery = searchParams.get("q") || "";
  const sortQuery = searchParams.get("sort") || "";
  const [filters, setFilters] = useState({ category: "", size: [] as string[], discount: "", min_price: "", max_price: "" });
  const [filterOptions, setFilterOptions] = useState<ProductFilters>({ categories: [], brands: [], sizes: [], colors: [], price: { min: 0, max: 0 } });
  useEffect(() => { getProductFilters().then(setFilterOptions).catch(() => setFilterOptions((current) => current)); }, []);
  const { catalog, loading, error } = useCatalog({ q: searchQuery, sort: sortQuery, category: filters.category, size: filters.size.join(","), discount: filters.discount, min_price: filters.min_price, max_price: filters.max_price });
  const toggleSize = (value: string) => setFilters((current) => ({ ...current, size: current.size.includes(value) ? current.size.filter((item) => item !== value) : [...current.size, value] }));
  const changeSort = (value: string) => { const params = new URLSearchParams(searchParams); if (value) params.set("sort", value); else params.delete("sort"); setSearchParams(params); };
  return <PageShell><main className="shop-page">
    <div className="breadcrumbs"><Link to="/">Home</Link> / <Link to="/shop">Men</Link>{filters.category && <> / <Link to={`/shop?category=${encodeURIComponent(filters.category)}`}>{filterOptions.categories.find((category) => category.slug === filters.category)?.name || filters.category}</Link></>}</div>
    <div className="shop-title"><div><h1>{searchQuery ? `Search results for “${searchQuery}”` : "Men's Shirts"}</h1><p>{catalog.length} products from the Humbell catalog</p></div></div>
    <div className="products-toolbar"><button className="filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>☷ Filters</button><span className="toolbar-results">{catalog.length} products</span><label>Sort by<select aria-label="Sort products" value={sortQuery} onChange={(event) => changeSort(event.target.value)}><option value="">Recommended</option><option value="best">Best sellers</option><option value="new">Newest</option></select></label></div>
    <div className="shop-layout">
      <aside className={`filter-panel ${filtersOpen ? "open" : ""}`}><div className="filter-head"><b>Filters</b><button onClick={() => setFilters({ category: "", size: [], discount: "", min_price: "", max_price: "" })}>Clear all</button></div>
        <section><h3>Category<span>−</span></h3>{filterOptions.categories.map((category) => <label key={category.slug}><input type="radio" name="category" checked={filters.category === category.slug} onChange={() => setFilters((current) => ({ ...current, category: category.slug }))} />{category.name}</label>)}</section>
        <section><h3>Size<span>−</span></h3>{filterOptions.sizes.map((value) => <label key={value}><input type="checkbox" checked={filters.size.includes(value)} onChange={() => toggleSize(value)} />{value}</label>)}</section>
        <section><h3>Discount<span>−</span></h3>{[10, 20, 30, 50].map((value) => <label key={value}><input type="radio" name="discount" checked={filters.discount === String(value)} onChange={() => setFilters((current) => ({ ...current, discount: String(value) }))} />{value}% and above</label>)}</section>
        <section><h3>Custom price</h3><div className="price-inputs"><input value={filters.min_price} onChange={(event) => setFilters((current) => ({ ...current, min_price: event.target.value }))} placeholder="Min" /><input value={filters.max_price} onChange={(event) => setFilters((current) => ({ ...current, max_price: event.target.value }))} placeholder="Max" /><button type="button">Go</button></div></section>
      </aside>
      <div>{loading ? <p>Loading products...</p> : error ? <p role="alert">Unable to load products: {error}</p> : <><div className="active-filters"><span>{catalog.length} results</span></div><div className="catalog-grid">{catalog.map((item) => <CatalogCard item={item} key={item.id} />)}</div></>}</div>
    </div>
  </main></PageShell>;
}

export function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { catalog, loading, error } = useCatalog();
  const item = catalog.find((product) => product.slug === slug);
  const [size, setSize] = useState("M");
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cartError, setCartError] = useState("");
  const [image, setImage] = useState("");
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  useEffect(() => { if (!item || !localStorage.getItem("humbell_token")) { setWishlisted(false); return; } getWishlist().then((result) => setWishlisted(result.results.some((product) => product.id === item.id))).catch(() => setWishlisted(false)); }, [item?.id]);
  useEffect(() => { const availableSize = item?.variants.find((variant) => variant.stock_quantity > 0)?.size; if (availableSize) setSize(availableSize); }, [item?.id]);
  if (loading) return <PageShell><main className="product-page"><p>Loading product...</p></main></PageShell>;
  if (error) return <PageShell><main className="product-page"><h1>Could not load this product</h1><p role="alert">{error}</p><Link className="primary-action" to="/shop">Back to shop</Link></main></PageShell>;
  if (!item) return <PageShell><main className="product-page"><h1>Product not found</h1><Link className="primary-action" to="/shop">Back to shop</Link></main></PageShell>;
  const productImages = item.images?.length ? item.images : [item.image].filter(Boolean);
  const selectedImage = image && productImages.includes(image) ? image : productImages[0] || item.image;
  const handleAdd = async () => {
    const variant = item.variants.find((candidate) => candidate.size === size) || item.variants[0];
    if (!variant) return setCartError("This product is currently unavailable.");
    if (!localStorage.getItem("humbell_token")) { deferAuthAction({ type: "cart", variantId: variant.id, quantity: qty, returnTo: "/cart" }); return navigateToSignIn(); }
    setAdding(true); setCartError("");
    try { await addToCart(variant.id, qty); window.location.href = "/cart"; } catch (error) { setCartError((error as Error).message); } finally { setAdding(false); }
  };
  const handleWishlist = async () => {
    if (!localStorage.getItem("humbell_token")) { deferAuthAction({ type: "wishlist", productId: item.id, returnTo: `/product/${item.slug}` }); navigate("/signin"); return; }
    setWishlistBusy(true); setCartError("");
    try { if (wishlisted) await removeFromWishlist(item.id); else await addToWishlist(item.id); setWishlisted(!wishlisted); }
    catch (requestError) { setCartError((requestError as Error).message); }
    finally { setWishlistBusy(false); }
  };
  const navigateToSignIn = () => { window.location.href = "/signin"; };
  return <PageShell><main className="product-page">
    <div className="breadcrumbs"><Link to="/">Home</Link> / <Link to="/shop">{item.category || "Shirts"}</Link> / <span aria-current="page">{item.name}</span></div>
    <div className="detail-layout">
      <div className="detail-gallery"><div className="thumbs">{productImages.map((source, index) => <button aria-label={`Show product image ${index + 1}`} onClick={() => setImage(source)} className={selectedImage === source ? "active" : ""} key={`${source}-${index}`}><img src={source} alt={`${item.name} view ${index + 1}`} /></button>)}</div><div className="main-photo"><img src={selectedImage} alt={item.name} /><span>Hover to zoom</span></div></div>
      <div className="detail-info"><small>{item.brand}</small><h1>{item.name}</h1><p className="detail-price">₹{item.price.toLocaleString("en-IN")} <del>₹{item.old.toLocaleString("en-IN")}</del><b>{Math.round((1 - item.price / item.old) * 100)}% OFF</b></p><p className="tax">Inclusive of all taxes · Free delivery</p>
        <p className="detail-copy">{item.description || "Product details are being updated. Please check back soon."}</p>
        <div className="option-head"><b>Select size</b><button type="button">Size guide</button></div><div className="size-row">{item.variants.map((variant) => <button disabled={variant.stock_quantity < 1} className={size === variant.size ? "active" : ""} onClick={() => setSize(variant.size)} key={variant.id}>{variant.size}</button>)}</div>
        <div className="buy-row"><div className="quantity"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><span>{qty}</span><button onClick={() => setQty(qty + 1)}>+</button></div><button className="primary-action" onClick={handleAdd} disabled={adding}>{adding ? "Adding..." : "Add to bag"}</button><button className={`wish-action ${wishlisted ? "active" : ""}`} aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wishlisted} onClick={handleWishlist} disabled={wishlistBusy}>{wishlisted ? "♥" : "♡"}</button></div>{cartError && <p role="alert">{cartError}</p>}<Link className="buy-now" to="/checkout">Buy now — ₹{(item.price * qty).toLocaleString("en-IN")}</Link>
        <div className="delivery-box"><b>Delivery to 560001</b><span>Order today, delivered by Thursday</span><button>Change pincode</button></div>
        <section className="product-information"><h2>Product information</h2><dl><div><dt>Brand</dt><dd>{item.brand}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div>{item.tag && <div><dt>Collection</dt><dd>{item.tag}</dd></div>}<div><dt>Available sizes</dt><dd>{item.variants.filter((variant) => variant.stock_quantity > 0).map((variant) => variant.size).join(", ") || "Currently unavailable"}</dd></div>{item.variants.find((variant) => variant.size === size) && <div><dt>SKU</dt><dd>{item.variants.find((variant) => variant.size === size)?.sku}</dd></div>}</dl><div className="product-service-details"><p><b>Delivery</b><span>Free delivery on this order.</span></p><p><b>Returns</b><span>15-day return policy applies.</span></p></div></section>
      </div>
    </div>
    <section className="related"><h2>You may also like</h2><div className="catalog-grid">{catalog.slice(0,4).map((product) => <CatalogCard item={product} key={product.id} />)}</div></section>
  </main></PageShell>;
}

export function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { getCart().then((result) => setItems(result.results)).catch((requestError: Error) => setError(requestError.message)).finally(() => setLoading(false)); }, []);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const changeQuantity = async (item: CartItem, quantity: number) => { try { const updated = await updateCartItem(item.id, Math.max(1, quantity)); setItems((current) => current.map((entry) => entry.id === updated.id ? { ...entry, quantity: updated.quantity } : entry)); } catch (requestError) { setError((requestError as Error).message); } };
  const remove = async (id: number) => { try { await removeCartItem(id); setItems((current) => current.filter((item) => item.id !== id)); } catch (requestError) { setError((requestError as Error).message); } };
  if (loading) return <PageShell><main className="simple-page"><p>Loading your shopping bag...</p></main></PageShell>;
  return <PageShell><main className="simple-page"><div className="page-title"><h1>Your shopping bag</h1><span>{items.length} items</span></div>{error && <p role="alert">{error}</p>}{items.length === 0 ? <p>Your shopping bag is empty.</p> : <div className="cart-layout"><div className="cart-items"><div className="delivery-note"><b>Free delivery unlocked</b><span>Your order qualifies for complimentary shipping.</span></div>{items.map((item) => <article className="cart-item" key={item.id}><img src={item.product.image} alt={item.product.name} /><div><small>{item.product.brand}</small><h3>{item.product.name}</h3><p>Size: {item.size} &nbsp; · &nbsp; Colour: {item.product.color}</p><p><b>₹{item.product.price.toLocaleString("en-IN")}</b> <del>₹{item.product.old.toLocaleString("en-IN")}</del></p><div className="cart-item-actions"><div className="quantity"><button onClick={() => changeQuantity(item, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item, item.quantity + 1)}>+</button></div><button onClick={() => remove(item.id)}>Remove</button></div></div></article>)}</div><OrderSummary subtotal={subtotal} action="/checkout" label="Proceed to checkout" /></div>}</main></PageShell>;
}

function OrderSummary({ subtotal = 3298, action, label, onAction }: { subtotal?: number; action: string; label: string; onAction?: () => void }) {
  return <aside className="order-summary"><h2>Order summary</h2><div><span>Subtotal</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div><div><span>Delivery</span><b className="saving">FREE</b></div><hr /><div className="summary-total"><span>Total</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div>{onAction ? <button className="primary-action" onClick={onAction}>{label}</button> : <Link className="primary-action" to={action}>{label}</Link>}<small>Secure checkout powered by Razorpay</small></aside>;
}

export function CheckoutPage() {
  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [addressDraft, setAddressDraft] = useState<Omit<Address, "id">>({
    full_name: "", phone: "", line1: "", line2: "", city: "", state: "",
    pincode: "", landmark: "", is_default: false,
  });
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getAddresses(), getCart()])
      .then(([addressResult, cartResult]) => {
        setAddresses(addressResult.results);
        setSelectedAddressId(addressResult.results.find((address) => address.is_default)?.id ?? addressResult.results[0]?.id ?? null);
        setCartItems(cartResult.results);
      })
      .catch((error: Error) => setPaymentError(error.message))
      .finally(() => setLoading(false));
  }, []);

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentError("");
    try {
      const saved = await createAddress(addressDraft);
      setAddresses((current) => [...current, saved]);
      setSelectedAddressId(saved.id);
      setStep(2);
    } catch (error) {
      setPaymentError((error as Error).message);
    }
  };

  const payWithRazorpay = async () => {
    if (!selectedAddressId) {
      setPaymentError("Add or choose a delivery address first.");
      return;
    }
    setPaymentError("");
    setPaying(true);
    try {
      const order = await createPaymentOrder(selectedAddressId);
      if (!window.Razorpay) throw new Error("Secure Razorpay checkout did not load. Please refresh and try again.");
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Humbell",
        description: "Secure online payment",
        order_id: order.id,
        modal: { ondismiss: () => setPaying(false) },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verified = await verifyPayment(response);
            sessionStorage.setItem("humbell_order_number", verified.order_number);
            sessionStorage.setItem("humbell_payment_method", "razorpay");
            navigate("/order-success");
          } catch (error) {
            setPaymentError((error as Error).message);
            setPaying(false);
          }
        },
      });
      checkout.open();
    } catch (error) {
      setPaymentError((error as Error).message);
      setPaying(false);
    }
  };

  const placeCodOrder = async () => {
    if (!selectedAddressId) {
      setPaymentError("Add or choose a delivery address first.");
      return;
    }
    setPaymentError("");
    setPaying(true);
    try {
      const order = await createCodOrder(selectedAddressId);
      sessionStorage.setItem("humbell_order_number", order.order_number);
      sessionStorage.setItem("humbell_payment_method", "cod");
      navigate("/order-success");
    } catch (error) {
      setPaymentError((error as Error).message);
      setPaying(false);
    }
  };

  const setDraftField = (field: keyof Omit<Address, "id">, value: string) => {
    setAddressDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <PageShell>
      <main className="checkout-page">
        <h1>Secure checkout</h1>
        {paymentError && <p role="alert">{paymentError}</p>}
        {loading ? <p>Loading your cart and saved addresses...</p> : cartItems.length === 0 ? (
          <section className="checkout-card"><p>Your bag is empty.</p><Link className="primary-action" to="/shop">Shop products</Link></section>
        ) : (
          <>
            <div className="checkout-steps">
              {["Address", "Delivery", "Payment", "Confirmation"].map((label, index) => (
                <div className={step >= index + 1 ? "active" : ""} key={label}>
                  <span>{step > index + 1 ? "✓" : index + 1}</span><b>{label}</b>
                </div>
              ))}
            </div>
            <div className="checkout-layout">
              <div>
                <section className={"checkout-card " + (step === 1 ? "current" : "")}>
                  <header><span>1</span><h2>Delivery address</h2>{step > 1 && <button onClick={() => setStep(1)}>Change</button>}</header>
                  {step === 1 && <div className="address-form">
                    {addresses.map((address) => (
                      <label className="wide checkout-address-choice" key={address.id}>
                        <input type="radio" name="checkout-address" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                        <span><b>{address.full_name}</b><small>{address.line1}{address.line2 ? ", " + address.line2 : ""}, {address.city}, {address.state} {address.pincode} · {address.phone}</small></span>
                      </label>
                    ))}
                    <h3 className="wide">{addresses.length ? "Add another address" : "Add a delivery address"}</h3>
                    <form className="address-form wide" onSubmit={saveAddress}>
                      {([
                        ["full_name", "Full name"], ["phone", "Mobile number"], ["line1", "House / flat / street"],
                        ["line2", "Area (optional)"], ["city", "City"], ["state", "State"],
                        ["pincode", "Pincode"], ["landmark", "Landmark (optional)"],
                      ] as const).map(([field, label]) => (
                        <label key={field}>{label}
                          <input
                            required={!["line2", "landmark"].includes(field)}
                            value={addressDraft[field]}
                            onChange={(event) => setDraftField(field, event.target.value)}
                          />
                        </label>
                      ))}
                      <button className="primary-action" type="submit">Save address and continue</button>
                    </form>
                    {addresses.length > 0 && <button className="primary-action" onClick={() => setStep(2)} disabled={!selectedAddressId}>Use selected address</button>}
                  </div>}
                </section>
                <section className={"checkout-card " + (step === 2 ? "current" : "")}>
                  <header><span>2</span><h2>Delivery</h2>{step > 2 && <button onClick={() => setStep(2)}>Change</button>}</header>
                  {step === 2 && <div className="delivery-options">
                    <label><input type="radio" checked readOnly name="delivery" /><span><b>Standard delivery</b><small>Delivery estimate shown after order confirmation</small></span><strong>FREE</strong></label>
                    <button className="primary-action" onClick={() => setStep(3)}>Continue to payment</button>
                  </div>}
                </section>
                <section className={"checkout-card " + (step === 3 ? "current" : "")}>
                  <header><span>3</span><h2>Payment method</h2></header>
                  {step === 3 && <div className="payment-area">
                    <label className={"payment-choice " + (paymentMethod === "razorpay" ? "active" : "")}>
                      <input type="radio" name="payment" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} />
                      <span><b>Pay online with Razorpay</b><small>UPI, cards, net banking and wallets in secure checkout</small></span>
                      <strong>Recommended</strong>
                    </label>
                    <label className={"payment-choice " + (paymentMethod === "cod" ? "active" : "")}>
                      <input type="radio" name="payment" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                      <span><b>Cash on delivery</b><small>Pay in cash when your order arrives</small></span>
                    </label>
                    <button className="primary-action" onClick={paymentMethod === "cod" ? placeCodOrder : payWithRazorpay} disabled={paying}>
                      {paying ? (paymentMethod === "cod" ? "Placing order..." : "Opening secure Razorpay checkout...") : paymentMethod === "cod" ? "Place COD order · ₹" + subtotal.toLocaleString("en-IN") : "Continue to Razorpay · ₹" + subtotal.toLocaleString("en-IN")}
                    </button>
                  </div>}
                </section>
              </div>
              <aside className="order-summary">
                <h2>Order summary</h2>
                <div><span>Subtotal</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div>
                <div><span>Delivery</span><b className="saving">FREE</b></div>
                <hr />
                <div className="summary-total"><span>Total</span><b>₹{subtotal.toLocaleString("en-IN")}</b></div>
                <small>Razorpay online payments are completed in secure checkout.</small>
              </aside>
            </div>
          </>
        )}
      </main>
    </PageShell>
  );
}
export function OrderSuccessPage() {
  const [order, setOrder] = useState<import("./api").UserOrder | null>(null);
  const paymentMethod = sessionStorage.getItem("humbell_payment_method") || "razorpay";
  useEffect(() => {
    const orderNumber = sessionStorage.getItem("humbell_order_number");
    getOrders().then((result) => setOrder(result.results.find((item) => item.order_number === orderNumber) || null));
  }, []);
  return (
    <PageShell>
      <main className="success-page">
        <div className="success-mark">✓</div>
        <p>{paymentMethod === "cod" ? "CASH ON DELIVERY" : "PAYMENT CONFIRMED"}</p>
        <h1>Order placed successfully!</h1>
        <span>{paymentMethod === "cod" ? "Your order is confirmed. Please pay the delivery partner when it arrives." : "Your Razorpay payment has been verified and your order is being prepared."}</span>
        {order ? <>
          <div className="success-details">
            <div><small>Order ID</small><b>{order.order_number}</b></div>
            <div><small>Order date</small><b>{new Date(order.created_at).toLocaleDateString("en-IN")}</b></div>
            <div><small>Payment</small><b>{paymentMethod === "cod" ? "Pay on delivery" : order.payment_status}</b></div>
            <div><small>Total</small><b>₹{Number(order.total).toLocaleString("en-IN")}</b></div>
          </div>
          <div className="success-address">
            <b>Delivering to</b>
            <p>{order.address.full_name} · {order.address.line1}, {order.address.city}, {order.address.state} {order.address.pincode}</p>
          </div>
        </> : <p>Loading your order confirmation...</p>}
        <div className="success-actions">
          <Link className="primary-action" to="/track-order">Track order</Link>
          <Link to="/orders">View orders</Link>
          <Link to="/shop">Continue shopping</Link>
        </div>
      </main>
    </PageShell>
  );
}
export function OrdersPage() {
  const [tab, setTab] = useState("All orders");
  const [orders, setOrders] = useState<import("./api").UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    getOrders(tab === "All orders" ? "all" : tab.toLowerCase())
      .then((result) => setOrders(result.results))
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [tab]);
  return <PageShell><AccountLayout active="orders"><div className="account-content"><h1>My orders</h1><div className="order-tabs">{["All orders", "Processing", "Shipped", "Delivered", "Cancelled"].map((value) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{value}</button>)}</div>{loading ? <p>Loading orders...</p> : error ? <p role="alert">{error}</p> : orders.length === 0 ? <p>No orders found for this filter.</p> : orders.map((order) => <article className="order-card" key={order.id}><header><div><small>ORDER ID</small><b>{order.order_number}</b></div><div><small>ORDERED ON</small><b>{new Date(order.created_at).toLocaleDateString("en-IN")}</b></div><div><small>TOTAL</small><b>{"\u20B9"}{Number(order.total).toLocaleString("en-IN")}</b></div><span className={"status " + order.status}>{order.status}</span></header><div><img src={order.items[0]?.image} alt={order.items[0]?.name || ""} /><section><h3>{order.items[0]?.name || "Order items"}</h3><p>{order.items[0] ? "Size " + order.items[0].size + " · Qty " + order.items[0].quantity : "No item details"}</p><b>Payment: {order.payment_status}</b></section><aside><Link to="/track-order">Track order</Link></aside></div></article>)}</div></AccountLayout></PageShell>;
}
export function TrackingPage() {
  const stages = ["Order placed","Payment confirmed","Order processing","Packed","Shipped","Out for delivery","Delivered"];
  const [order, setOrder] = useState<import("./api").UserOrder | null>(null); const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  useEffect(() => { getOrders().then((result) => setOrder(result.results[0] || null)).catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);
  const contactCourier = async () => { if (!order) return; try { await createSupportTicket(`Courier help for ${order.order_number}`, `The customer needs help with delivery for order ${order.order_number}.`); setMessage("Courier support request sent."); } catch (error) { setMessage((error as Error).message); } };
  if (loading) return <PageShell><main className="tracking-page"><p>Loading tracking details...</p></main></PageShell>;
  if (!order) return <PageShell><main className="tracking-page"><h1>No orders to track</h1><p>{message || "Place an order to see delivery tracking here."}</p><Link className="primary-action" to="/shop">Shop products</Link></main></PageShell>;
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.toLowerCase().includes(order.status)));
  const item = order.items[0];
  return <PageShell><main className="tracking-page"><div className="breadcrumbs"><Link to="/orders">My orders</Link> / {order.order_number}</div><div className="tracking-head"><div><p>ORDER {order.order_number}</p><h1>{order.status === "delivered" ? "Delivered" : "Your order is on the way"}</h1><span>{message || `Current status: ${order.status}`}</span></div><span className={`status ${order.status}`}>{order.status}</span></div><section className="tracker"><div className="tracker-line"><span style={{ width: `${Math.max(12, (currentIndex + 1) / stages.length * 100)}%` }} /></div>{stages.map((stage,index) => <div className={index <= currentIndex ? "done" : ""} key={stage}><i>{index <= currentIndex ? "✓" : index + 1}</i><b>{stage}</b><small>{index <= currentIndex ? "Complete" : "Pending"}</small></div>)}</section><div className="tracking-grid"><article><h2>Shipment details</h2><div><span>Courier</span><b>Humbell delivery partner</b></div><div><span>Tracking number</span><b>{order.order_number}</b></div><div><span>Status</span><b>{order.status}</b></div><button onClick={contactCourier}>Contact courier</button></article><article><h2>Delivery address</h2><b>{order.address.full_name}</b><p>{order.address.line1}<br />{order.address.line2 && <>{order.address.line2}<br /></>}{order.address.city}, {order.address.state} {order.address.pincode}</p><span>{order.address.phone}</span></article>{item && <article className="tracked-product"><img src={item.image} alt={item.name} /><div><b>{item.name}</b><span>Size {item.size} · Qty {item.quantity}</span><strong>₹{Number(item.unit_price).toLocaleString("en-IN")}</strong></div></article>}</div></main></PageShell>;
}

function AccountLayout({ children, active = "profile" }: { children: React.ReactNode; active?: string }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => { getCurrentUser().then(setUser).catch(() => setUser(null)); }, []);
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  return <main className="account-page"><aside><div className="account-user"><span>{initials}</span><div><small>Welcome back</small><b>{user?.name || "Your account"}</b></div></div>{[["profile","Profile","/account"],["orders","My orders","/orders"],["addresses","Addresses","/addresses"],["wishlist","Wishlist","/wishlist"],["support","Support","/support"]].map(([key,label,path]) => <Link className={active === key ? "active" : ""} to={path} key={key}>{label}<span>›</span></Link>)}<button onClick={() => signOut().then(() => navigate("/signin"))}>Log out</button></aside>{children}</main>;
}

export function AddressesPage() {
  return <PageShell><AccountLayout active="addresses"><div className="account-content"><h1>Saved addresses</h1><p>Manage your delivery addresses and choose a default address for checkout.</p><AddressBook /></div></AccountLayout></PageShell>;
}

export function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountCounts, setAccountCounts] = useState({ orders: 0, addresses: 0, wishlist: 0 });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordValues, setPasswordValues] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  useEffect(() => { getCurrentUser().then(setUser).catch(() => setUser(null)); }, []);
  useEffect(() => { Promise.all([getOrders(), getAddresses(), getWishlist()]).then(([orders, addresses, wishlist]) => setAccountCounts({ orders: orders.count, addresses: addresses.results.length, wishlist: wishlist.results.length })).catch(() => setAccountCounts({ orders: 0, addresses: 0, wishlist: 0 })); }, []);
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordError(""); setPasswordMessage("");
    if (passwordValues.next !== passwordValues.confirm) { setPasswordError("The new passwords do not match."); return; }
    setSavingPassword(true);
    try {
      const result = await changePassword(passwordValues.current, passwordValues.next, passwordValues.confirm);
      setPasswordMessage(result.detail); setPasswordValues({ current: "", next: "", confirm: "" }); setPasswordOpen(false);
    } catch (error) { setPasswordError((error as Error).message); }
    finally { setSavingPassword(false); }
  };
  return <PageShell><AccountLayout><div className="account-content"><h1>My profile</h1><section className="profile-card"><div className="profile-avatar">{initials}</div><div><p>PERSONAL INFORMATION</p><label>Full name<input value={user?.name || "Loading profile..."} readOnly /></label><label>Email address<input value={user?.email || "Loading profile..."} readOnly /></label><label>Phone number<input value={user?.phone || "Not added yet"} readOnly /></label><small>Your profile details are loaded from your Humbell account.</small></div></section><div className="account-summary"><article><span>{accountCounts.orders}</span><b>Orders placed</b><Link to="/orders">View orders</Link></article><article><span>{accountCounts.addresses}</span><b>Saved addresses</b><Link to="/addresses">Manage</Link></article><article><span>{accountCounts.wishlist}</span><b>Wishlist items</b><Link to="/wishlist">View wishlist</Link></article></div><section className="security-card"><div><h2>Password & security</h2><p>Update your password securely.</p></div><button type="button" onClick={() => { setPasswordOpen((open) => !open); setPasswordMessage(""); setPasswordError(""); }}>{passwordOpen ? "Cancel" : "Change password"}</button></section>{passwordMessage && <p role="status">{passwordMessage}</p>}{passwordError && <p role="alert">{passwordError}</p>}{passwordOpen && <form className="password-change-form" onSubmit={submitPassword}><label>Current password<input type="password" autoComplete="current-password" value={passwordValues.current} onChange={(event) => setPasswordValues({ ...passwordValues, current: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" minLength={8} value={passwordValues.next} onChange={(event) => setPasswordValues({ ...passwordValues, next: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={passwordValues.confirm} onChange={(event) => setPasswordValues({ ...passwordValues, confirm: event.target.value })} required /></label><button className="primary-action" type="submit" disabled={savingPassword}>{savingPassword ? "Saving..." : "Save new password"}</button></form>}</div></AccountLayout></PageShell>;
}

function AddressBook() {
  const emptyAddress: Omit<Address, "id"> = {
    full_name: "", phone: "", line1: "", line2: "", city: "", state: "",
    pincode: "", landmark: "", is_default: false,
  };
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyAddress);
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAddresses()
      .then((result) => setAddresses(result.results))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const change = (field: keyof typeof emptyAddress, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = editing ? await updateAddress(editing, form) : await createAddress(form);
      setAddresses((current) => {
        const next = editing
          ? current.map((address) => address.id === saved.id ? saved : address)
          : [...current, saved];
        return saved.is_default ? next.map((address) => ({ ...address, is_default: address.id === saved.id })) : next;
      });
      setForm({ ...emptyAddress, is_default: addresses.length === 0 });
      setEditing(null);
      setMessage("Address saved.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id: number) => {
    setMessage("");
    try {
      const saved = await updateAddress(id, { is_default: true });
      setAddresses((current) => current.map((address) => ({ ...address, is_default: address.id === saved.id })));
      setMessage("Default address updated.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const remove = async (address: Address) => {
    setMessage("");
    try {
      await deleteAddress(address.id);
      const remaining = addresses.filter((item) => item.id !== address.id);
      if (address.is_default && remaining.length) {
        const promoted = await updateAddress(remaining[0].id, { is_default: true });
        setAddresses(remaining.map((item) => ({ ...item, is_default: item.id === promoted.id })));
      } else {
        setAddresses(remaining);
      }
      setMessage("Address deleted.");
      if (editing === address.id) {
        setEditing(null);
        setForm({ ...emptyAddress });
      }
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <section className="address-book">
      <p role="status">{message}</p>
      {addresses.length === 0 && <p>No saved addresses yet. Add one below.</p>}
      <div className="address-list">
        {addresses.map((address) => (
          <article className="saved-address-card" key={address.id}>
            <div>
              <b>{address.full_name}</b>
              {address.is_default && <span className="default-address-badge">Default</span>}
              <p>{address.line1}{address.line2 ? ", " + address.line2 : ""}</p>
              <p>{address.city}, {address.state} {address.pincode}</p>
              <p>{address.phone}{address.landmark ? " · " + address.landmark : ""}</p>
            </div>
            <div className="saved-address-actions">
              {!address.is_default && <button type="button" onClick={() => makeDefault(address.id)}>Make default</button>}
              <button type="button" onClick={() => { setEditing(address.id); setForm({ ...address }); }}>Edit</button>
              <button type="button" onClick={() => remove(address)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      <form className="address-edit-form" onSubmit={submit}>
        <h2>{editing ? "Edit address" : "Add a new address"}</h2>
        <div className="address-form">
          {([
            ["full_name", "Full name"], ["phone", "Phone"], ["line1", "Address line 1"],
            ["line2", "Address line 2"], ["city", "City"], ["state", "State"],
            ["pincode", "Pincode"], ["landmark", "Landmark"],
          ] as const).map(([field, label]) => (
            <label key={field}>{label}
              <input
                required={["full_name", "phone", "line1", "city", "state", "pincode"].includes(field)}
                value={form[field]}
                onChange={(event) => change(field, event.target.value)}
              />
            </label>
          ))}
          <label className="wide address-default-option">
            <input type="checkbox" checked={form.is_default} onChange={(event) => change("is_default", event.target.checked)} />
            Set as default address
          </label>
          <div className="wide address-form-actions">
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update address" : "Add address"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ ...emptyAddress }); }}>Cancel</button>}
          </div>
        </div>
      </form>
    </section>
  );
}
export function WishlistPage() {
  const [items, setItems] = useState<StoreProduct[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { getWishlist().then((result) => setItems(result.results)).catch((requestError: Error) => setError(requestError.message)).finally(() => setLoading(false)); }, []);
  const remove = async (id: number) => { try { await removeFromWishlist(id); setItems((current) => current.filter((item) => item.id !== id)); } catch (requestError) { setError((requestError as Error).message); } };
  return <PageShell><AccountLayout active="wishlist"><div className="account-content"><div className="page-title"><h1>My wishlist</h1><span>{items.length} saved pieces</span></div>{loading ? <p>Loading wishlist...</p> : error ? <p role="alert">{error}</p> : items.length === 0 ? <p>Your wishlist is empty.</p> : <div className="catalog-grid wishlist-grid">{items.map((item) => <article key={item.id} className="catalog-card"><Link className="catalog-photo" to={`/product/${item.slug}`}><img src={item.image} alt={item.name} /><span>{item.tag}</span></Link><div className="catalog-body"><small>{item.brand}</small><Link to={`/product/${item.slug}`}>{item.name}</Link><p><b>₹{item.price.toLocaleString("en-IN")}</b></p><button onClick={() => remove(item.id)}>Remove</button></div></article>)}</div>}</div></AccountLayout></PageShell>;
}

export function AuthPage() {
  const [signup, setSignup] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [password, setPassword] = useState(""); const [otp, setOtp] = useState(""); const [otpSent, setOtpSent] = useState(false); const [resendIn, setResendIn] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (resendIn <= 0) return; const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000); return () => window.clearTimeout(timer); }, [resendIn]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (!signup) { await signIn(email, password); navigate(await completePendingAuthAction("/account")); return; }
      if (!otpSent) { await sendSignupOtp(name, email, password); setOtpSent(true); setResendIn(60); setOtp(""); return; }
      await signUp(name, email, phone, password, otp); navigate(await completePendingAuthAction("/account"));
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  };
  const toggleSignup = () => { setSignup((current) => !current); setOtpSent(false); setOtp(""); setResendIn(0); setError(""); };
  const resendOtp = async () => { setError(""); setBusy(true); try { await sendSignupOtp(name, email, password); setOtp(""); setResendIn(60); } catch (requestError) { setError((requestError as Error).message); } finally { setBusy(false); } };
  return <div className="auth-page"><Seo /><Link className="route-brand" to="/"><img src={logo} alt="Humbell" /><span>HUMBELL<small>WEAR YOUR STORY</small></span></Link><div className="auth-visual"><img src="https://images.unsplash.com/photo-1596732395264-36901fb0db89?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200&h=1400" alt="Man in Humbell shirt" /><div><p>WELCOME TO HUMBELL</p><h2>Wear your story,<br />with confidence.</h2></div></div><main className="auth-card"><Link to="/">? Back to store</Link><p>{signup ? "JOIN HUMBELL" : "WELCOME BACK"}</p><h1>{signup ? "Create your account" : "Sign in to your account"}</h1><span>{signup ? "Unlock faster checkout, order tracking and member offers." : "Access your orders, wishlist and personalised picks."}</span>{otpSent && signup && <p className="signup-otp-note" role="status">We sent a 6-digit verification code to {email}. It expires in 10 minutes.</p>}{error && <p role="alert">{error}</p>}<form onSubmit={submit}>{signup && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" required /></label>}<label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" readOnly={signup && otpSent} required /></label>{signup && otpSent && <button className="change-signup-email" type="button" onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}>Use a different email</button>}{signup && <label>Mobile number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label>}<label>Password<div><input value={password} onChange={(event) => setPassword(event.target.value)} type={visible ? "text" : "password"} placeholder="At least 8 characters" required minLength={8} /><button type="button" onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button></div></label>{signup && otpSent && <label>Email verification code<input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Enter 6-digit code" required /></label>}{signup && !otpSent && <label className="terms"><input type="checkbox" required />I agree to the Terms & Conditions and Privacy Policy.</label>}{signup && otpSent && <button className="resend-signup-otp" type="button" onClick={resendOtp} disabled={busy || resendIn > 0}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend verification code"}</button>}<button className="primary-action" type="submit" disabled={busy}>{busy ? "Please wait..." : signup ? otpSent ? "Verify code & create account" : "Send verification code" : "Sign in"}</button></form><p className="auth-switch">{signup ? "Already a member?" : "New to Humbell?"}<button onClick={toggleSignup}>{signup ? "Sign in" : "Create an account"}</button></p></main></div>;
}

export function SupportPage() {
  const categories = ["Orders", "Payments", "Delivery", "Returns", "Refunds", "Account", "Products"];
  const questions = [
    { category: "Orders", question: "Where is my order?", answer: "Open My Orders to see the latest status. Choose Track order for delivery details." },
    { category: "Returns", question: "How do I return an item?", answer: "Contact our support team with your order number and the item you want to return. We will guide you through the return." },
    { category: "Refunds", question: "When will I receive my refund?", answer: "Refund timing depends on your payment provider. Contact support with your order number if you need an update." },
    { category: "Delivery", question: "Can I change my delivery address?", answer: "Before an order ships, contact support as soon as possible. You can manage saved addresses from your account." },
    { category: "Payments", question: "Which payment methods can I use?", answer: "Checkout supports Razorpay online payments and cash on delivery where available." },
    { category: "Account", question: "How do I update my account password?", answer: "Sign in and open My Account. Use Password & security to change your password." },
    { category: "Products", question: "How do I choose the right size?", answer: "Check the size options on the product page. If you need help with fit, send our support team the product name and your usual size." },
  ];
  const [open, setOpen] = useState<string | null>(questions[0].question);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticketNotice, setTicketNotice] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [sending, setSending] = useState(false);
  const visibleQuestions = questions.filter((item) => (!category || item.category === category) && `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(query.trim().toLowerCase()));
  const sendTicket = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setTicketError(""); setTicketNotice("");
    try { await createSupportTicket(subject, message); setTicketNotice("Your support request was sent. Our team will get back to you."); setSubject(""); setMessage(""); setTicketOpen(false); }
    catch (error) { setTicketError((error as Error).message); }
    finally { setSending(false); }
  };
  return <PageShell><main className="support-page"><section className="support-hero"><p>HUMBELL HELP CENTER</p><h1>How can we help?</h1><div><MiniIcon>⌕</MiniIcon><input aria-label="Search help articles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders, returns, payments and more" /><button type="button" onClick={() => setCategory("")}>Search</button></div><span>Popular: Track order · Start a return · Payment issue</span></section><section className="support-categories">{categories.map((item,index) => <button aria-pressed={category === item} className={category === item ? "selected" : ""} onClick={() => setCategory(category === item ? "" : item)} key={item}><span>{String(index+1).padStart(2,"0")}</span><b>{item}</b><small>{category === item ? "Showing help" : "Browse help ›"}</small></button>)}</section><div className="support-columns"><section><p>HELP ARTICLES{category ? ` · ${category.toUpperCase()}` : ""}</p><h2>Frequently asked</h2>{visibleQuestions.length ? visibleQuestions.map((item) => <div className={open === item.question ? "open" : ""} key={item.question}><button aria-expanded={open === item.question} onClick={() => setOpen(open === item.question ? null : item.question)}>{item.question}<span>{open === item.question ? "−" : "+"}</span></button>{open === item.question && <p>{item.answer}</p>}</div>) : <p>No help articles match that search. Send us a support request and we’ll help you directly.</p>}</section><aside><p>STILL NEED HELP?</p><h2>Talk to a human</h2><span>Our support team is available Monday–Saturday, 9 AM–7 PM.</span><a className="support-contact-link" href="mailto:care@humbell.in">Email care@humbell.in</a><button type="button" onClick={() => { setTicketOpen((value) => !value); setTicketError(""); setTicketNotice(""); }}>{ticketOpen ? "Close request form" : "Raise a support ticket"}</button>{ticketNotice && <small role="status">{ticketNotice}</small>}{ticketError && <small className="support-error" role="alert">{ticketError} {ticketError.toLowerCase().includes("credentials") || ticketError.toLowerCase().includes("authentication") ? <Link to="/signin">Sign in</Link> : null}</small>}<small>We’ll reply to your account email.</small></aside></div>{ticketOpen && <form className="support-ticket-form" onSubmit={sendTicket}><h2>Send a support request</h2><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} required /></label><label>How can we help?<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} required /></label>{ticketError && <p role="alert">{ticketError}</p>}<button className="primary-action" disabled={sending}>{sending ? "Sending..." : "Send request"}</button></form>}</main></PageShell>;
}

export function ContentPage({ type }: { type: "about" | "contact" | "policy" }) {
  if (type === "contact") return <PageShell><main className="content-page"><div><p>CONTACT HUMBELL</p><h1>We're here to help.</h1><span>Questions about an order, fit or anything else? Our team would love to hear from you.</span><h3>care@humbell.in</h3><h3>+91 80000 00000</h3><p>Mon–Sat, 9 AM–7 PM<br />Bengaluru, Karnataka, India</p></div><form><label>Name<input /></label><label>Email<input /></label><label>Phone<input /></label><label>Subject<select><option>Choose a subject</option><option>Order help</option><option>Product question</option></select></label><label className="wide">Message<textarea rows={6} /></label><button className="primary-action">Send message</button></form></main></PageShell>;
  if (type === "about") return <PageShell><main><section className="about-hero"><img src="https://images.unsplash.com/photo-1664856514301-08d72e3f1d4f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1600&h=900" alt="" /><div><p>OUR STORY</p><h1>Made for who<br />you're becoming.</h1></div></section><section className="about-copy"><p>Humbell began with one simple belief: great style should feel effortless.</p><div><article><span>01</span><h2>Quality, considered</h2><p>From fabric to final stitch, every detail earns its place.</p></article><article><span>02</span><h2>Customer first</h2><p>We listen, learn and create for how modern India really dresses.</p></article><article><span>03</span><h2>Confidence, daily</h2><p>Clothes should free you to focus on what matters most.</p></article></div></section></main></PageShell>;
  return <PageShell><main className="policy-page"><div className="breadcrumbs"><Link to="/">Home</Link> / Policies</div><h1>Terms & policies</h1><p>Last updated: 14 June 2026</p>{["Overview","Orders and payments","Shipping and delivery","Returns and refunds","Privacy and data","Contact us"].map((title) => <section key={title}><h2>{title}</h2><p>Humbell is committed to a transparent and trustworthy shopping experience. This section explains the terms that apply when you browse, purchase, return or interact with our services. Information is presented clearly so you always understand your choices and rights.</p></section>)}</main></PageShell>;
}

export function AdminPage() {
  const { section = "dashboard" } = useParams();
  const [menu, setMenu] = useState(false);
  const [adminUser, setAdminUser] = useState<AuthUser | null>(null);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const sections = ["dashboard","products","orders","customers","payments","coupons","support","analytics","notifications"];

  useEffect(() => {
    if (!localStorage.getItem("humbell_token")) {
      setAccess("denied");
      return;
    }
    let active = true;
    getCurrentUser().then((user) => {
      if (!active) return;
      setAdminUser(user);
      setAccess(user.is_superuser ? "allowed" : "denied");
    }).catch(() => {
      if (active) setAccess("denied");
    });
    return () => { active = false; };
  }, []);

  if (access === "checking") return <PageShell><main className="admin-access-denied" aria-live="polite">Checking admin access?</main></PageShell>;
  if (access === "denied") {
    const signedIn = Boolean(localStorage.getItem("humbell_token"));
    return <PageShell><main className="admin-access-denied" role="alert"><h1>Access denied</h1><p>You are not allowed to access the admin panel. Only a superuser can open this area.</p><Link className="primary-action" to={signedIn ? "/" : "/signin"}>{signedIn ? "Return to store" : "Sign in"}</Link></main></PageShell>;
  }

  return <div className="admin-shell"><Seo /><aside className={menu ? "open" : ""}><Link className="route-brand inverse" to="/"><img src={logo} alt="" /><span>HUMBELL<small>ADMIN CONSOLE</small></span></Link><p>MANAGEMENT</p>{sections.map((value) => <Link className={section === value ? "active" : ""} to={`/admin/${value}`} key={value}><span>{value.slice(0,1).toUpperCase()}</span>{value[0].toUpperCase()+value.slice(1)}</Link>)}<div className="admin-user"><span>{(adminUser?.name || adminUser?.email || "SU").slice(0, 2).toUpperCase()}</span><div><b>{adminUser?.name || adminUser?.email}</b><small>Superuser</small></div></div></aside><main className="admin-main"><header><button onClick={() => setMenu(!menu)}>?</button><div><h1>{section[0].toUpperCase()+section.slice(1)}</h1><p>Welcome back. Here's what's happening today.</p></div><div className="admin-head-actions"><Link to="/admin/notifications">Notifications</Link><Link to="/">View store</Link></div></header>{section === "dashboard" ? <AdminDashboard /> : section === "products" ? <AdminProducts /> : section === "orders" ? <AdminOrders /> : section === "customers" ? <AdminCustomers /> : section === "support" ? <AdminSupport /> : section === "analytics" ? <AdminAnalyticsPage /> : section === "notifications" ? <AdminNotifications /> : <AdminGeneric section={section} />}</main></div>;
}

function AdminDashboard() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  useEffect(() => { getAdminSummary().then(setSummary).catch(() => setSummary(null)); }, []);
  const kpis = summary ? [[`₹${Number(summary.sales).toLocaleString("en-IN")}`, "Total sales", "Live"], [summary.orders.toLocaleString("en-IN"), "Total orders", "Live"], [summary.pending_orders.toString(), "Pending orders", "Action needed"], [summary.customers.toLocaleString("en-IN"), "Customers", "Live"], [summary.products.toString(), "Products", "Live"]] : [];
  return <div className="admin-content"><div className="kpi-grid">{kpis.map((item) => <article key={item[1]}><span>{item[1]}</span><b>{item[0]}</b><small>{item[2]}</small></article>)}</div><div className="admin-charts"><article className="sales-chart"><header><div><h2>Sales overview</h2><p>Live store performance</p></div><select><option>Current totals</option></select></header><div className="chart-area"><p>Sales data is connected to your order records.</p></div></article><article className="donut-card"><h2>Store totals</h2><p><span>Products</span><b>{summary?.products ?? "-"}</b></p><p><span>Customers</span><b>{summary?.customers ?? "-"}</b></p><p><span>Pending orders</span><b>{summary?.pending_orders ?? "-"}</b></p></article></div><AdminRecent summary={summary || undefined} /></div>;
}

function AdminRecent({ summary: initialSummary }: { summary?: AdminSummary }) {
  const [summary, setSummary] = useState<AdminSummary | undefined>(initialSummary);
  useEffect(() => { if (!initialSummary) getAdminSummary().then(setSummary).catch(() => setSummary(undefined)); }, [initialSummary]);
  return <section className="admin-table-card"><header><div><h2>Recent orders</h2><p>Latest purchases across your store</p></div><Link to="/admin/orders">View all orders</Link></header><div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{summary?.recent_orders.map((order) => <tr key={order.order_number}><td><b>{order.order_number}</b></td><td>{order.customer || "Guest"}</td><td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td><td><b>₹{Number(order.total).toLocaleString("en-IN")}</b></td><td><span className={`status ${order.status}`}>{order.status}</span></td></tr>)}</tbody></table></div></section>;
}

function AdminProducts() {
  const LOW_STOCK_LIMIT = 5;
  const empty = { name: "", brand: "HUMBELL", description: "", category: "Shirts", price: "", compare_at_price: "", image_url: "", tag: "", sizes: "S,M,L,XL,XXL", stock_by_size: { S: "10", M: "10", L: "10", XL: "10", XXL: "10" } as Record<string, string> };
  const [products, setProducts] = useState<AdminProduct[]>([]); const [form, setForm] = useState(empty); const [imageQueue, setImageQueue] = useState<{ key: string; url: string; file?: File }[]>([]); const [draggedImage, setDraggedImage] = useState<string | null>(null); const [editing, setEditing] = useState<number | null>(null); const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [error, setError] = useState("");
  const load = () => getAdminProducts().then((result) => setProducts(result.results)).catch((requestError: Error) => setError(requestError.message));
  useEffect(() => { load(); }, []);
  const selectedSizes = form.sizes.split(",").map((size) => size.trim()).filter(Boolean);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const payload = new FormData(); Object.entries(form).forEach(([key, value]) => { if (key !== "stock_by_size") payload.append(key, value as string); }); payload.append("stock_by_size", JSON.stringify(form.stock_by_size)); const uploadIndexes = new Map<string, number>(); imageQueue.forEach((item) => { if (item.file) { uploadIndexes.set(item.key, uploadIndexes.size); payload.append("images", item.file); } }); payload.append("image_order", JSON.stringify(imageQueue.map((item) => item.key.startsWith("upload:") ? `upload:${uploadIndexes.get(item.key)}` : item.key))); try { const saved = editing ? await updateAdminProduct(editing, payload) : await createAdminProduct(payload); imageQueue.forEach((item) => { if (item.file) URL.revokeObjectURL(item.url); }); setProducts((current) => editing ? current.map((product) => product.id === saved.id ? saved : product) : [saved, ...current]); setForm(empty); setImageQueue([]); setEditing(null); setOpen(false); setError(""); } catch (requestError) { setError((requestError as Error).message); } };
  const edit = (product: AdminProduct) => { setEditing(product.id); setImageQueue(product.image_items || []); setForm({ name: product.name, brand: product.brand, description: product.description || "", category: product.category, price: product.price, compare_at_price: product.compare_at_price || "", image_url: product.image_url, tag: product.tag, sizes: product.skus.map((sku) => sku.size).join(","), stock_by_size: Object.fromEntries(product.skus.map((sku) => [sku.size, String(sku.stock_quantity)])) }); setOpen(true); };
  const moveImage = (sourceKey: string, targetKey: string) => setImageQueue((current) => { const from = current.findIndex((item) => item.key === sourceKey); const to = current.findIndex((item) => item.key === targetKey); if (from < 0 || to < 0 || from === to) return current; const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  const removeImage = (key: string) => setImageQueue((current) => { const removed = current.find((item) => item.key === key); if (removed?.file) URL.revokeObjectURL(removed.url); return current.filter((item) => item.key !== key); });
  const remove = async (id: number) => { if (!window.confirm("Delete this product?")) return; try { await deleteAdminProduct(id); setProducts((current) => current.filter((product) => product.id !== id)); } catch (requestError) { setError((requestError as Error).message); } };
  const visible = products.filter((product) => `${product.name} ${product.brand} ${product.slug}`.toLowerCase().includes(query.toLowerCase()));
  const lowStockVariants = products.flatMap((product) => product.skus.filter((variant) => variant.stock_quantity <= LOW_STOCK_LIMIT).map((variant) => ({ product: product.name, size: variant.size, quantity: variant.stock_quantity })));
  return <div className="admin-content"><div className="admin-toolbar"><div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or SKU" /></div><button onClick={() => { setEditing(null); setForm(empty); setImageQueue([]); setOpen(true); }}>+ Add product</button></div>{lowStockVariants.length > 0 && <div className="low-stock-alert" role="alert"><b>Low stock alert</b><span>{lowStockVariants.filter((variant) => variant.quantity === 0).length} out of stock, {lowStockVariants.filter((variant) => variant.quantity > 0).length} size variants at or below {LOW_STOCK_LIMIT} units.</span></div>}{error && <p role="alert">{error}</p>}{open && <form className="admin-product-form" onSubmit={submit}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product name" required /><input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Brand" /><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Category name" required /><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Price" required /><input type="number" min="0" step="0.01" value={form.compare_at_price} onChange={(event) => setForm({ ...form, compare_at_price: event.target.value })} placeholder="Compare at price" /><input value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} placeholder="Tag" /><textarea className="admin-description-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Product description" rows={4} /><input value={form.sizes} onChange={(event) => { const sizes = event.target.value; const next = sizes.split(",").map((size) => size.trim()).filter(Boolean); setForm({ ...form, sizes, stock_by_size: Object.fromEntries(next.map((size) => [size, form.stock_by_size[size] ?? "10"])) }); }} placeholder="Sizes: S,M,L,XL,XXL" required /><fieldset className="stock-by-size-editor"><legend>Units in stock for each size</legend>{selectedSizes.map((size) => <label className="stock-size-field" key={size}><span>{size}</span><input type="number" min="0" step="1" required value={form.stock_by_size[size] ?? "10"} onChange={(event) => setForm({ ...form, stock_by_size: { ...form.stock_by_size, [size]: event.target.value } })} />{Number(form.stock_by_size[size] ?? "10") === 0 ? <small className="stock-out">Out of stock</small> : Number(form.stock_by_size[size] ?? "10") <= LOW_STOCK_LIMIT ? <small className="stock-low">Low stock</small> : null}</label>)}</fieldset><input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} placeholder="External image URL" /><label className="admin-image-upload">Product images<input type="file" accept="image/*" multiple aria-label="Upload product images" onChange={(event) => { const files = Array.from(event.target.files || []); setImageQueue((current) => [...current, ...files.map((file) => ({ key: `upload:${crypto.randomUUID()}`, url: URL.createObjectURL(file), file }))]); event.currentTarget.value = ""; }} /><small>Add images, remove old ones, or drag an image to the first position to make it the cover.</small></label><div className="admin-image-preview-grid">{imageQueue.map((item, index) => <div className="admin-image-preview draggable-image" key={item.key} draggable onDragStart={() => setDraggedImage(item.key)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedImage) moveImage(draggedImage, item.key); setDraggedImage(null); }}><img src={item.url} alt={`Product image ${index + 1}`} /><span>{index === 0 ? "Cover image · drag to reorder" : item.file?.name || `Image ${index + 1}`}</span><div className="image-order-actions">{index > 0 && <button type="button" onClick={() => moveImage(item.key, imageQueue[index - 1].key)}>Move earlier</button>}{index < imageQueue.length - 1 && <button type="button" onClick={() => moveImage(item.key, imageQueue[index + 1].key)}>Move later</button>}<button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(item.key)}>Remove</button></div></div>)}</div><button className="primary-action" type="submit">{editing ? "Update product" : "Create product"}</button><button type="button" onClick={() => { setOpen(false); imageQueue.forEach((item) => { if (item.file) URL.revokeObjectURL(item.url); }); setImageQueue([]); }}>Cancel</button></form>}<section className="admin-table-card"><div className="admin-table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Inventory by size</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((product) => <tr key={product.id}><td><div className="table-product"><img src={product.image} alt="" /><div><b>{product.name}</b><small>{product.brand}</small></div></div></td><td>{product.skus[0]?.sku || "-"}</td><td>{product.category}</td><td><b>₹{Number(product.price).toLocaleString("en-IN")}</b></td><td><div className="variant-stock-list">{product.skus.length ? product.skus.map((variant) => <span className={variant.stock_quantity === 0 ? "stock-row-out" : variant.stock_quantity <= LOW_STOCK_LIMIT ? "stock-row-low" : ""} key={variant.id}><b>{variant.size}</b>: {variant.stock_quantity} units {variant.stock_quantity === 0 ? <em>Out of stock</em> : variant.stock_quantity <= LOW_STOCK_LIMIT ? <em>Low stock</em> : null}</span>) : <span>No size variants</span>}<small>Total: {product.stock} units</small></div></td><td><span className="status paid">{product.is_active ? "Active" : "Inactive"}</span></td><td><button onClick={() => edit(product)}>Edit</button> <button onClick={() => remove(product.id)}>Delete</button></td></tr>)}</tbody></table></div></section></div>;
}

function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState("");
  const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  const refreshOrders = async () => {
    setRefreshing(true);
    try {
      const result = await getAdminOrders();
      setOrders(result.results);
      setError("");
    } catch (requestError) {
      const detail = (requestError as Error).message;
      setError(detail.toLowerCase().includes("permission")
        ? "Order management requires a Django staff account. Sign in with an account that has staff access."
        : detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void refreshOrders();
    const interval = window.setInterval(() => void refreshOrders(), 15000);
    window.addEventListener("focus", refreshOrders);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOrders);
    };
  }, []);
  const changeStatus = async (order: AdminOrder, status: string) => {
    setUpdating(order.id);
    setError("");
    try {
      const updated = await updateAdminOrderStatus(order.id, status);
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: updated.status } : item));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setUpdating(null);
    }
  };
  const visibleOrders = filter === "all" ? orders : orders.filter((order) => order.status === filter);
  return <div className="admin-content">
    <div className="admin-toolbar"><span>{orders.length} orders</span><button type="button" onClick={() => void refreshOrders()} disabled={refreshing}>{refreshing ? "Refreshing..." : "Refresh orders"}</button></div>
    <div className="admin-tabs">
      {["all", ...statuses].map((status) => <button className={filter === status ? "active" : ""} onClick={() => setFilter(status)} key={status}>{status === "all" ? "All orders" : status[0].toUpperCase() + status.slice(1)}</button>)}
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Loading orders...</p> : <section className="admin-table-card"><div className="admin-table-wrap">
      <table><thead><tr><th>Order</th><th>Customer & delivery</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>{visibleOrders.map((order) => <tr key={order.id}>
          <td><b>{order.order_number}</b></td>
          <td><b>{order.address.full_name || order.customer}</b><small>{order.email} · {order.address.phone}</small><small>{[order.address.line1, order.address.line2, order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(", ")}</small></td>
          <td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td>
          <td><b>₹{Number(order.total).toLocaleString("en-IN")}</b></td>
          <td><b>{order.payment_method === "cod" ? "Cash on delivery" : "Razorpay"}</b><small>{order.payment_status}</small></td>
          <td><select aria-label={"Status for order " + order.order_number} value={order.status} disabled={updating === order.id} onChange={(event) => changeStatus(order, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></td>
        </tr>)}{visibleOrders.length === 0 && <tr><td colSpan={6}>No orders in this status.</td></tr>}</tbody>
      </table>
    </div></section>}
  </div>;
}

function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]); const [error, setError] = useState("");
  useEffect(() => { getAdminCustomers().then((data) => setCustomers(data.results)).catch((err: Error) => setError(err.message)); }, []);
  return <div className="admin-content"><div className="admin-toolbar"><span>{customers.length} customers</span></div>{error && <p role="alert">{error}</p>}<section className="admin-table-card"><div className="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Lifetime order total</th><th>Joined</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><b>{customer.name}</b><small>{customer.email}</small></td><td>{customer.phone || "—"}</td><td>{customer.order_count}</td><td>₹{Number(customer.total_spent).toLocaleString("en-IN")}</td><td>{new Date(customer.joined_at).toLocaleDateString("en-IN")}</td></tr>)}{!customers.length && !error && <tr><td colSpan={5}>No customer accounts yet.</td></tr>}</tbody></table></div></section></div>;
}

function AdminSupport() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]); const [error, setError] = useState("");
  useEffect(() => { getAdminTickets().then((data) => setTickets(data.results)).catch((err: Error) => setError(err.message)); }, []);
  const change = async (ticket: AdminTicket, status: string) => { try { const updated = await updateAdminTicket(ticket.id, status); setTickets((current) => current.map((row) => row.id === ticket.id ? updated : row)); setError(""); } catch (err) { setError((err as Error).message); } };
  return <div className="admin-content">{error && <p role="alert">{error}</p>}<section className="admin-table-card"><div className="admin-table-wrap"><table><thead><tr><th>Request</th><th>Customer</th><th>Message</th><th>Created</th><th>Status</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><b>{ticket.subject}</b><small>#{ticket.id}</small></td><td>{ticket.customer}<small>{ticket.email}</small></td><td className="ticket-message">{ticket.message}</td><td>{new Date(ticket.created_at).toLocaleString("en-IN")}</td><td><select value={ticket.status} onChange={(event) => void change(ticket, event.target.value)}>{["open","in_progress","resolved","closed"].map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select></td></tr>)}{!tickets.length && !error && <tr><td colSpan={5}>No support requests yet.</td></tr>}</tbody></table></div></section></div>;
}

function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null); const [error, setError] = useState("");
  useEffect(() => { getAdminAnalytics().then(setData).catch((err: Error) => setError(err.message)); }, []);
  const metrics = data ? [[data.orders, "Orders"], [`₹${Number(data.gross_sales).toLocaleString("en-IN")}`, "Gross order total"], [data.pending_orders, "Awaiting fulfillment"], [data.cod_orders, "Cash on delivery"]] : [];
  return <div className="admin-content">{error && <p role="alert">{error}</p>}<div className="kpi-grid analytics-kpis">{metrics.map(([value,label]) => <article key={String(label)}><span>{label}</span><b>{value}</b></article>)}</div><section className="admin-table-card"><header><div><h2>Sales by payment mode</h2><p>Based on all placed orders</p></div></header><div className="admin-payment-summary"><article><span>Cash on delivery</span><b>{data?.cod_orders ?? 0} orders · ₹{Number(data?.cod_sales || 0).toLocaleString("en-IN")}</b></article><article><span>Razorpay</span><b>{data?.online_orders ?? 0} orders · ₹{Number(data?.online_sales || 0).toLocaleString("en-IN")}</b></article></div></section><section className="admin-table-card"><header><div><h2>Last 7 days</h2><p>Order count and gross order total per day</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Orders</th><th>Sales</th></tr></thead><tbody>{data?.daily_sales.map((day) => <tr key={day.date}><td>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</td><td>{day.orders}</td><td>₹{Number(day.sales).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div></section><section className="admin-table-card"><header><div><h2>Order status</h2></div></header><div className="admin-table-wrap"><table><thead><tr><th>Status</th><th>Orders</th></tr></thead><tbody>{data?.statuses.map((row) => <tr key={row.status}><td>{row.status}</td><td>{row.count}</td></tr>)}</tbody></table></div></section></div>;
}

function AdminNotifications() {
  const [events, setEvents] = useState<AdminNotification[]>([]); const [error, setError] = useState("");
  useEffect(() => { getAdminNotifications().then((data) => setEvents(data.results)).catch((err: Error) => setError(err.message)); }, []);
  return <div className="admin-content">{error && <p role="alert">{error}</p>}<div className="admin-notification-list">{events.map((event) => <Link key={event.id} to={event.url} className="admin-notification"><span>{event.kind === "order" ? "Order" : "Help"}</span><div><b>{event.title}</b><p>{event.detail}</p><small>{new Date(event.created_at).toLocaleString("en-IN")}</small></div></Link>)}{!events.length && !error && <p>No recent orders or support requests.</p>}</div></div>;
}

function AdminGeneric({ section }: { section: string }) {
  return <div className="admin-content"><div className="generic-admin"><span>{section[0].toUpperCase()}</span><h2>{section[0].toUpperCase()+section.slice(1)} management</h2><p>Manage all {section} operations from one clean, responsive workspace.</p><div className="kpi-grid">{[["24","Active"],["8","Needs attention"],["96%","Healthy"],["12","Updated today"]].map((x) => <article key={x[1]}><span>{x[1]}</span><b>{x[0]}</b></article>)}</div><button className="primary-action">Add new</button></div></div>;
}

export function NotFoundPage() {
  return <PageShell><main className="not-found"><b>404</b><h1>This page has wandered off.</h1><p>Let us get you back to something worth wearing.</p><Link className="primary-action" to="/">Back to home</Link></main></PageShell>;
}
