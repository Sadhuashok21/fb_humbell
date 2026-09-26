import { useEffect } from "react";
import { useLocation, useParams } from "react-router";

const pages: Record<string, { title: string; description: string }> = {
  "/": { title: "Humbell | Premium Menswear for Modern India", description: "Discover thoughtfully tailored shirts and premium menswear designed for everyday confidence." },
  "/shop": { title: "Shop Men's Shirts | Humbell", description: "Explore Humbell's collection of premium men's shirts, linen edits, formalwear and everyday essentials." },
  "/search": { title: "Search Men's Fashion | Humbell", description: "Search Humbell shirts, linen, formalwear and premium menswear." },
  "/cart": { title: "Your Shopping Bag | Humbell", description: "Review your selected Humbell pieces and continue to secure checkout." },
  "/checkout": { title: "Secure Checkout | Humbell", description: "Complete your Humbell order with secure delivery and payment options." },
  "/account": { title: "My Account | Humbell", description: "Manage your Humbell profile, saved addresses and account details." },
  "/orders": { title: "My Orders | Humbell", description: "View and track your Humbell orders." },
  "/wishlist": { title: "My Wishlist | Humbell", description: "View your saved Humbell styles." },
  "/signin": { title: "Sign In or Create an Account | Humbell", description: "Sign in to manage orders, addresses and your Humbell wishlist." },
  "/support": { title: "Help Center | Humbell", description: "Get help with Humbell orders, payments, delivery, returns and your account." },
  "/about": { title: "Our Story | Humbell", description: "Learn how Humbell makes considered menswear for modern India." },
  "/contact": { title: "Contact Humbell", description: "Contact the Humbell team about orders, fit, products and support." },
};

export function Seo() {
  const { pathname } = useLocation();
  const { slug } = useParams();
  useEffect(() => {
    const productName = slug ? slug.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") : "Product Details";
    const base = pages[pathname] || (pathname.startsWith("/product/") ? { title: `${productName} | Humbell`, description: `Shop ${productName} from Humbell's premium menswear collection.` } : { title: "Humbell | Premium Menswear", description: "Premium menswear for modern India." });
    document.title = base.title;
    const description = document.querySelector('meta[name="description"]') || document.createElement("meta");
    description.setAttribute("name", "description"); description.setAttribute("content", base.description); document.head.appendChild(description);
  }, [pathname, slug]);
  return null;
}