import { useEffect, useState } from "react";
import logo from "../imports/humbell512-1.png";
import { Seo } from "./seo";
import { AuthUser, addToCart as addCartItem, addToWishlist, CartItem, getCart, getCurrentUser, getProducts, removeFromWishlist, StoreProduct } from "./api";

type IconName =
  | "search"
  | "mic"
  | "user"
  | "heart"
  | "bag"
  | "arrow"
  | "truck"
  | "shield"
  | "refresh"
  | "chevron"
  | "menu"
  | "close"
  | "instagram"
  | "facebook"
  | "youtube";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    bag: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M18 12a6 6 0 0 0-10.5-4M6 12a6 6 0 0 0 10.5 4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
    facebook: <path d="M14 21v-8h3l.5-3H14V8.5c0-1 .4-1.5 1.8-1.5H18V4.2c-.7-.1-1.6-.2-2.7-.2C12.6 4 11 5.6 11 8.5V10H8v3h3v8" />,
    youtube: <><path d="M21 12s0-4-.5-5.5c-.3-1-1-1.5-2-1.8C16.8 4.3 12 4.3 12 4.3s-4.8 0-6.5.4c-1 .3-1.7.8-2 1.8C3 8 3 12 3 12s0 4 .5 5.5c.3 1 1 1.5 2 1.8 1.7.4 6.5.4 6.5.4s4.8 0 6.5-.4c1-.3 1.7-.8 2-1.8C21 16 21 12 21 12Z" /><path d="m10 9 5 3-5 3V9Z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

type HomeProduct = StoreProduct & { category: string; priceLabel: string; oldLabel: string; off: string };

const categories = [
  { label: "Linen Edit", sub: "Summer, simplified", image: "https://images.unsplash.com/photo-1643930757648-b0ec5c7a9dfa?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=1000" },
  { label: "Workwear", sub: "Made to mean business", image: "https://images.unsplash.com/photo-1539125530496-3ca408f9c2d9?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=1000" },
  { label: "After Hours", sub: "Own the evening", image: "https://images.unsplash.com/photo-1618902752068-62a02e3b2453?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800&h=1000" },
];

function ProductCard({ product, onAdd }: { product: HomeProduct; onAdd: (product: HomeProduct) => void }) {
  const [liked, setLiked] = useState(false);
  const toggleWishlist = async () => {
    if (!localStorage.getItem("humbell_token")) return window.location.assign("/signin");
    try { if (liked) await removeFromWishlist(product.id); else await addToWishlist(product.id); setLiked(!liked); } catch { setLiked(false); }
  };
  return (
    <article className="product-card">
      <div className="product-image">
        <img src={product.image} alt={`${product.name} worn by a male model`} />
        <span className="deal-pill">BESTSELLER</span>
        <button className={`heart-button ${liked ? "liked" : ""}`} onClick={toggleWishlist} aria-label="Add to wishlist"><Icon name="heart" /></button>
        <button className="quick-add" onClick={() => onAdd(product)}>Quick add</button>
      </div>
      <div className="product-info">
        <p className="eyebrow">{product.category}</p>
        <h3>{product.name}</h3>
        <div className="price-line"><strong>{product.priceLabel}</strong><del>{product.oldLabel}</del><em>{product.off}</em></div>
        <div className="product-meta"><span>{product.color}</span><span>S · M · L · XL · XXL</span></div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [toast, setToast] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [productError, setProductError] = useState("");

  useEffect(() => {
    const refreshUser = () => {
      if (!localStorage.getItem("humbell_token")) return setUser(null);
      getCurrentUser().then(setUser).catch(() => setUser(null));
    };
    refreshUser();
  }, []);

  const refreshCart = () => {
    if (!localStorage.getItem("humbell_token")) { setCartItems([]); return; }
    getCart().then((result) => setCartItems(result.results)).catch(() => setCartItems([]));
  };
  useEffect(refreshCart, []);

  useEffect(() => {
    getProducts()
      .then((items) => setProducts(items.slice(0, 4).map((product) => ({
        ...product,
        category: product.brand,
        priceLabel: `₹${product.price.toLocaleString("en-IN")}`,
        oldLabel: `₹${product.old.toLocaleString("en-IN")}`,
        off: `${Math.round((1 - product.price / product.old) * 100)}% OFF`,
      }))))
      .catch((error: Error) => setProductError(error.message));
  }, []);

  const addToCart = async (product: HomeProduct) => {
    if (!localStorage.getItem("humbell_token")) return window.location.assign("/signin");
    const variant = product.variants[0];
    if (!variant) return;
    try {
      await addCartItem(variant.id);
      refreshCart();
      setToast(true);
      window.setTimeout(() => setToast(false), 2400);
    } catch (error) { console.error("Could not add item to bag", error); }
  };
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);

  return (
    <div className="site-shell">
      <Seo />
      <div className="announcement">
        <span>EXTRA 10% OFF ON YOUR FIRST ORDER</span>
        <span className="announcement-center">Use code <b>HELLO10</b></span>
        <span>FREE DELIVERY ABOVE ₹999</span>
      </div>

      <header className="header">
        <div className="header-main">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <a className="brand" href="#">
            <img src={logo} alt="Humbell bell and bird logo" />
            <span>HUMBELL<small>WEAR YOUR STORY</small></span>
          </a>

          <div className="search-wrap">
            <div className="search-bar">
              <Icon name="search" size={21} />
              <input aria-label="Search products" placeholder="Search shirts, linen, formal wear and more" onFocus={() => setSearchOpen(true)} />
              <button aria-label="Voice search"><Icon name="mic" size={19} /></button>
            </div>
            {searchOpen && (
              <div className="search-panel">
                <div className="search-title"><span>POPULAR RIGHT NOW</span><button onClick={() => setSearchOpen(false)}><Icon name="close" size={17} /></button></div>
                {["Premium linen shirts", "White shirts for men", "New season checks", "Shirts under ₹1,499"].map((item) => (
                  <button className="search-result" key={item}><Icon name="search" size={16} />{item}<Icon name="arrow" size={15} /></button>
                ))}
                <div className="trending-chips"><span>Trending:</span><button>Oxford</button><button>Party wear</button><button>Oversized</button></div>
              </div>
            )}
          </div>

          <div className="header-actions">
            <button onClick={() => { window.location.href = user ? "/account" : "/signin"; }}><Icon name="user" /><span>{user ? `Hello, ${user.name}` : "Hello, sign in"}<small>{user ? "Profile" : "Account"}</small></span></button>
            <button className="wishlist-action" onClick={() => { window.location.href = "/wishlist"; }}><Icon name="heart" /><span>Saved<small>Wishlist</small></span></button>
            <button className="cart-action" onClick={() => { window.location.href = "/cart"; }}><Icon name="bag" /><i>{cartCount}</i><span>Your bag<small>{"\u20B9"}{cartTotal.toLocaleString("en-IN")}</small></span></button>
          </div>
        </div>
        <nav className="nav">
          <a href="/shop?sort=new">New In <span>NEW</span></a>
          <a href="/shop">Shirts</a>
          <a href="/shop">Casual</a>
          <a href="/shop">Formal</a>
          <a href="/shop">Linen</a>
          <a href="/shop">Premium</a>
          <a href="/shop?sale=true" className="sale-link">The Sale</a>
          <div />
          <a href="/track-order">Track Order</a>
          <a href="/support">Help</a>
        </nav>
      </header>

      {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={`mobile-drawer ${mobileOpen ? "open" : ""}`}>
        <div className="drawer-head"><a className="brand" href="#"><img src={logo} alt="" /><span>HUMBELL</span></a><button onClick={() => setMobileOpen(false)}><Icon name="close" /></button></div>
        <p>SHOP</p>
        {["New In", "Shirts", "Casual", "Formal", "Linen", "Premium", "The Sale"].map((item) => <a href="#shop" onClick={() => setMobileOpen(false)} key={item}>{item}<Icon name="chevron" size={17} /></a>)}
        <p>YOUR ACCOUNT</p>
        <a href={user ? "/account" : "/signin"}>{user ? "View your account" : "Sign in / Create account"}<Icon name="chevron" size={17} /></a>
        <a href="/track-order">Track an order<Icon name="chevron" size={17} /></a>
      </aside>

      <main onClick={() => searchOpen && setSearchOpen(false)}>
        <section className="hero">
          <img className="hero-image" src="https://images.unsplash.com/photo-1596732395264-36901fb0db89?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=90&w=1800&h=1100" alt="Man confidently wearing a Humbell blue shirt" />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="hero-kicker">THE NEW SIGNATURE COLLECTION</p>
            <h1>Style that<br />speaks <i>for you.</i></h1>
            <p>Thoughtfully tailored shirts for men who make every moment count.</p>
            <div className="hero-buttons"><a className="button light" href="/shop">Shop shirts <Icon name="arrow" /></a><a className="button ghost" href="/shop?sort=new">Explore collection</a></div>
          </div>
          <div className="hero-card">
            <span>NEW SEASON</span>
            <b>The Signature<br />Blue Oxford</b>
            <div><strong>₹1,499</strong><a href="/product/blue-oxford">Shop look <Icon name="arrow" size={16} /></a></div>
          </div>
          <div className="hero-dots"><span /><span className="active" /><span /></div>
        </section>

        <section className="promise-strip">
          <div><Icon name="truck" /><span><b>Free delivery</b><small>On orders over ₹999</small></span></div>
          <div><Icon name="refresh" /><span><b>Easy 15-day returns</b><small>No questions asked</small></span></div>
          <div><Icon name="shield" /><span><b>Secure payments</b><small>Razorpay protected</small></span></div>
          <div><Icon name="shield" /><span><b>Premium quality</b><small>Crafted to last</small></span></div>
        </section>

        <section className="section categories" id="new">
          <div className="section-heading centered">
            <p>CURATED FOR EVERY MOMENT</p>
            <h2>Find your signature</h2>
            <span>From Monday meetings to Sunday escapes.</span>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <a className="category-card" href="/shop" key={category.label}>
                <img src={category.image} alt={category.label} />
                <div className="category-overlay" />
                <div><p>{category.sub}</p><h3>{category.label}</h3><span>Shop the edit <Icon name="arrow" size={17} /></span></div>
              </a>
            ))}
          </div>
        </section>

        <section className="section products" id="shop">
          <div className="section-heading row">
            <div><p>MOST LOVED</p><h2>Trending right now</h2></div>
            <a href="/shop">View all shirts <Icon name="arrow" size={18} /></a>
          </div>
          <div className="product-grid">
            {productError ? <p role="alert">Unable to load products: {productError}</p> : products.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}
          </div>
        </section>

        <section className="blue-banner" id="offers">
          <div className="blue-copy">
            <p>HUMBELL MEMBER DAYS</p>
            <h2>More style.<br />More rewards.</h2>
            <span>Join HUMBELL Circle and enjoy early access, member pricing and a birthday surprise.</span>
            <div><a className="button light" href="/signin">Join for free <Icon name="arrow" /></a><a href="/signin">Sign in</a></div>
          </div>
          <div className="blue-visual">
            <img src="https://images.unsplash.com/photo-1627686011747-74adda3d2343?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000&h=900" alt="Humbell member in a crisp white shirt" />
            <div className="circle-card"><small>MEMBERS SAVE</small><b>15%</b><span>on their next look</span></div>
          </div>
        </section>

        <section className="section story">
          <div className="story-image"><img src="https://images.unsplash.com/photo-1664856514301-08d72e3f1d4f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000&h=1200" alt="Man in timeless Humbell style" /><span>Designed in India<br />Made for everywhere</span></div>
          <div className="story-copy">
            <p>OUR PROMISE</p>
            <h2>Better shirts.<br /><i>Fewer compromises.</i></h2>
            <p className="story-body">At Humbell, we obsess over the details you feel—the softness of the cotton, the confidence of a perfect fit, and the ease of a shirt made for real life.</p>
            <div className="story-points">
              <div><b>01</b><span><strong>Considered fabrics</strong><small>Soft, breathable and responsibly sourced.</small></span></div>
              <div><b>02</b><span><strong>Fits that feel personal</strong><small>Tested across real Indian body types.</small></span></div>
              <div><b>03</b><span><strong>Quality, without the markup</strong><small>Premium craft at an honest price.</small></span></div>
            </div>
            <a href="/about">Discover our story <Icon name="arrow" size={18} /></a>
          </div>
        </section>

        <section className="newsletter">
          <div><p>THE HUMBELL EDIT</p><h2>Good style, delivered.</h2><span>New drops, private offers and considered style advice. No clutter.</span></div>
          <form onSubmit={(event) => event.preventDefault()}><input type="email" placeholder="Your email address" aria-label="Email address" /><button>Join the list <Icon name="arrow" size={18} /></button></form>
        </section>
      </main>

      <footer id="support">
        <div className="footer-top">
          <div className="footer-brand"><a className="brand" href="#"><img src={logo} alt="" /><span>HUMBELL<small>WEAR YOUR STORY</small></span></a><p>Everyday confidence, thoughtfully made. Premium menswear for modern India.</p><div className="socials"><a href="#" aria-label="Instagram"><Icon name="instagram" /></a><a href="#" aria-label="Facebook"><Icon name="facebook" /></a><a href="#" aria-label="Youtube"><Icon name="youtube" /></a></div></div>
          <div><h3>Shop</h3><a href="#">New arrivals</a><a href="#">Best sellers</a><a href="#">Formal shirts</a><a href="#">Casual shirts</a><a href="#">The sale</a></div>
          <div><h3>Help</h3><a href="#">Track order</a><a href="#">Returns & refunds</a><a href="#">Size guide</a><a href="#">Contact us</a><a href="#">FAQs</a></div>
          <div><h3>About</h3><a href="#">Our story</a><a href="#">Careers</a><a href="#">Privacy policy</a><a href="#">Terms & conditions</a><a href="#">Shipping policy</a></div>
          <div className="contact"><h3>We're here to help</h3><a href="tel:+918000000000">+91 80000 00000</a><a href="mailto:care@humbell.in">care@humbell.in</a><small>Mon–Sat, 9 AM–7 PM</small><span>SECURE PAYMENTS</span><p>Razorpay &nbsp; · &nbsp; UPI &nbsp; · &nbsp; VISA</p></div>
        </div>
        <div className="footer-bottom"><span>© 2026 Humbell. All rights reserved.</span><span>Designed with purpose in India.</span></div>
      </footer>

      <nav className="mobile-bottom">
        <a className="active" href="#"><Icon name="menu" /><span>Home</span></a>
        <a href="/search"><Icon name="search" /><span>Search</span></a>
        <a href="/shop"><Icon name="menu" /><span>Categories</span></a>
        <a href="/cart"><Icon name="bag" /><i>{cartCount}</i><span>Bag</span></a>
        <a href="/account"><Icon name="user" /><span>Profile</span></a>
      </nav>

      <div className={`toast ${toast ? "show" : ""}`}><span><Icon name="shield" size={19} /></span><div><b>Added to your bag</b><small>Ready when you are.</small></div><button onClick={() => { window.location.href = "/cart"; }}>View bag</button></div>
    </div>
  );
}
