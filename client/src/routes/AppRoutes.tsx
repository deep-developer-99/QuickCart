import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

const AccountPrivacy = lazy(() => import("../pages/user/AccountPrivacy"));
const DeleteAccount = lazy(() => import("../pages/user/DeleteAccount"));
const DeleteAccountFeedback = lazy(() => import("../pages/user/DeleteAccountFeedback"));
const AccountDeactivated = lazy(() => import("../pages/user/AccountDeactivated"));
const CategoryProducts = lazy(() => import("../pages/user/CategoryProducts"));
const CategoriesPage = lazy(() => import("../pages/user/CategoriesPage"));
const SearchResults = lazy(() => import("../pages/user/SearchResults"));

import HomeRoute from "./HomeRoute";
import PublicRoute from "./PublicRoute";
import ProtectedRoute from "./ProtectedRoute";
const UserLayout = lazy(() => import("../layouts/UserLayout"));
const AccountLayout = lazy(() => import("../layouts/AccountLayout"));

import LoginRoute from "./LoginRoute";
import LoginModalHost from "./LoginModalHost";
import { LoginModalProvider } from "../context/LoginModalContext";

const ProductDetails = lazy(() => import("../pages/user/ProductDetails"));
const Cart = lazy(() => import("../pages/user/Cart"));
const Checkout = lazy(() => import("../pages/user/Checkout"));
const MyOrders = lazy(() => import("../pages/user/MyOrders"));
const MyOrderDetails = lazy(() => import("../pages/user/MyOrderDetails"));
const OrderConfirmation = lazy(() => import("../pages/user/OrderConfirmation"));
const Profile = lazy(() => import("../pages/user/Profile"));
const SavedAddresses = lazy(() => import("../pages/user/SavedAddresses"));

const VendorLogin = lazy(() => import("../pages/vendor/VendorLogin"));
const VendorRegister = lazy(() => import("../pages/vendor/VendorRegister"));
const VendorDashboard = lazy(() => import("../pages/vendor/VendorDashboard"));
const VendorProducts = lazy(() => import("../pages/vendor/VendorProducts"));
const VendorOrders = lazy(() => import("../pages/vendor/VendorOrders"));
const VendorOffers = lazy(() => import("../pages/vendor/VendorOffers"));
const VendorShopLocation = lazy(() => import("../pages/vendor/VendorShopLocation"));

const AdminLogin = lazy(() => import("../pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("../pages/admin/AdminUsers"));
const AdminVendors = lazy(() => import("../pages/admin/AdminVendors"));
const AdminProducts = lazy(() => import("../pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("../pages/admin/AdminCategories"));
const AdminSubCategories = lazy(() => import("../pages/admin/AdminSubCategories"));
const AdminBanners = lazy(() => import("../pages/admin/AdminBanners"));
const AdminMobileBanners = lazy(() => import("../pages/admin/AdminMobileBanners"));
const AdminOffers = lazy(() => import("../pages/admin/AdminOffers"));
const AdminOrders = lazy(() => import("../pages/admin/AdminOrders"));
const AdminTheme = lazy(() => import("../pages/admin/AdminTheme"));
const AdminPromotionalBanners = lazy(() => import("../pages/admin/AdminPromotionalBanners"));
const AdminFooter = lazy(() => import("../pages/admin/AdminFooter"));
const AdminSearchSuggestions = lazy(() => import("../pages/admin/AdminSearchSuggestions"));
const AdminHomepageSections = lazy(() => import("../pages/admin/AdminHomepageSections"));
const AdminMobileCategoryNavigation = lazy(() => import("../pages/admin/AdminMobileCategoryNavigation"));

import ScrollToTop from "../components/ScrollToTop";
const ContactUs = lazy(() => import("../pages/ContactUs"));

const RouteLoading = () => <div className="route-loading" role="status">Loading…</div>;
const load = (element: ReactNode) => <Suspense fallback={<RouteLoading />}>{element}</Suspense>;

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <LoginModalProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/account-deactivated" element={load(<AccountDeactivated />)} />
        <Route path="/contact" element={load(<ContactUs />)} />

        <Route element={load(<UserLayout />)}>
          <Route path="/" element={load(<HomeRoute />)} />
          <Route path="/categories" element={load(<CategoriesPage />)} />

          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/vendor/login" element={load(<VendorLogin />)} />
            <Route path="/vendor/register" element={load(<VendorRegister />)} />
            <Route path="/admin/login" element={load(<AdminLogin />)} />
          </Route>

          <Route path="/category/:categoryId" element={load(<CategoryProducts />)} />
          <Route path="/search" element={load(<SearchResults />)} />
          <Route path="/products/:id" element={load(<ProductDetails />)} />

          <Route element={<ProtectedRoute allowedRole="user" />}>
            <Route path="/cart" element={load(<Cart />)} />
          <Route path="/checkout" element={load(<Checkout />)} />
            <Route path="/order-confirmation" element={load(<OrderConfirmation />)} />

            <Route path="/account" element={load(<AccountLayout />)}>
              <Route index element={<Navigate to="/account/privacy" replace />} />
              <Route path="privacy" element={load(<AccountPrivacy />)} />
              <Route path="delete-account" element={load(<DeleteAccount />)} />
              <Route path="delete-account-feedback" element={load(<DeleteAccountFeedback />)} />
              <Route path="profile" element={load(<Profile />)} />
              <Route path="addresses" element={load(<SavedAddresses />)} />
              <Route path="orders" element={load(<MyOrders />)} />
              <Route path="orders/:id" element={load(<MyOrderDetails />)} />
            </Route>

            {/* Backward-compatible URLs */}
            <Route
              path="/me"
              element={<Navigate to="/account/profile" replace />}
            />
            <Route
              path="/saved-addresses"
              element={<Navigate to="/account/addresses" replace />}
            />
            <Route
              path="/my-orders"
              element={<Navigate to="/account/orders" replace />}
            />
            <Route
              path="/my-orders/:id"
              element={<Navigate to="/account/orders" replace />}
            />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="vendor" />}>
          <Route path="/vendor/dashboard" element={load(<VendorDashboard />)} />
          <Route path="/vendor/products" element={load(<VendorProducts />)} />
          <Route path="/vendor/orders" element={load(<VendorOrders />)} />
          <Route path="/vendor/offers" element={load(<VendorOffers />)} />
          <Route path="/vendor/shop-location" element={load(<VendorShopLocation />)} />
        </Route>

        <Route element={<ProtectedRoute allowedRole="admin" />}>
          <Route path="/admin/dashboard" element={load(<AdminDashboard />)} />
          <Route path="/admin/users" element={load(<AdminUsers />)} />
          <Route path="/admin/vendors" element={load(<AdminVendors />)} />
          <Route path="/admin/products" element={load(<AdminProducts />)} />
          <Route path="/admin/categories" element={load(<AdminCategories />)} />
          <Route path="/admin/subcategories" element={load(<AdminSubCategories />)} />
          <Route path="/admin/homepage-sections" element={load(<AdminHomepageSections />)} />
          <Route path="/admin/mobile-category-navigation" element={load(<AdminMobileCategoryNavigation />)} />
          <Route path="/admin/banners" element={load(<AdminBanners />)} />
          <Route path="/admin/mobile-banners" element={load(<AdminMobileBanners />)} />
          <Route path="/admin/offers" element={load(<AdminOffers />)} />
          <Route path="/admin/orders" element={load(<AdminOrders />)} />
          <Route path="/admin/theme" element={load(<AdminTheme />)} />
          <Route path="/admin/promotional-banners" element={load(<AdminPromotionalBanners />)} />
          <Route path="/admin/footer" element={load(<AdminFooter />)} />
          <Route path="/admin/search-suggestions" element={load(<AdminSearchSuggestions />)} />
        </Route>
      </Routes>
      <LoginModalHost />
      </LoginModalProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;
