import { createBrowserRouter } from "react-router";
import HomePage from "./HomePage";
import { LaunchControlPage, LaunchGate } from "./launch";
import {
  AccountPage,
  AddressesPage,
  AdminPage,
  AuthPage,
  CartPage,
  CheckoutPage,
  ContentPage,
  NotFoundPage,
  OrderSuccessPage,
  OrdersPage,
  ProductPage,
  ShopPage,
  SupportPage,
  TrackingPage,
  WishlistPage,
} from "./pages";

export const router = createBrowserRouter([
  { element: <LaunchGate />, children: [
  { path: "/", Component: HomePage },
  { path: "/shop", Component: ShopPage },
  { path: "/search", Component: ShopPage },
  { path: "/product/:slug", Component: ProductPage },
  { path: "/cart", Component: CartPage },
  { path: "/checkout", Component: CheckoutPage },
  { path: "/order-success", Component: OrderSuccessPage },
  { path: "/orders", Component: OrdersPage },
  { path: "/track-order", Component: TrackingPage },
  { path: "/wishlist", Component: WishlistPage },
  { path: "/account", Component: AccountPage },
  { path: "/addresses", Component: AddressesPage },
  { path: "/signin", Component: AuthPage },
  { path: "/launch", Component: LaunchControlPage },
  { path: "/support", Component: SupportPage },
  { path: "/about", element: <ContentPage type="about" /> },
  { path: "/contact", element: <ContentPage type="contact" /> },
  { path: "/policies/:policy", element: <ContentPage type="policy" /> },
  { path: "/admin", Component: AdminPage },
  { path: "/admin/:section", Component: AdminPage },
  { path: "*", Component: NotFoundPage },
  ] },
]);
