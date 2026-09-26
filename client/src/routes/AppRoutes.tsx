import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import CategoryProducts from "../pages/user/CategoryProducts";
import SearchResults from "../pages/user/SearchResults";

import HomeRoute from "./HomeRoute";
import PublicRoute from "./PublicRoute";
import ProtectedRoute from "./ProtectedRoute";
import UserLayout from "../layouts/UserLayout";
import AccountLayout from "../layouts/AccountLayout";

import Login from "../pages/user/Login";

import ProductDetails from "../pages/user/ProductDetails";
import Cart from "../pages/user/Cart";
import Checkout from "../pages/user/Checkout";
import MyOrders from "../pages/user/MyOrders";
import MyOrderDetails from "../pages/user/MyOrderDetails";
import OrderConfirmation from "../pages/user/OrderConfirmation";
import Profile from "../pages/user/Profile";
import SavedAddresses from "../pages/user/SavedAddresses";

import VendorLogin from "../pages/vendor/VendorLogin";
import VendorRegister from "../pages/vendor/VendorRegister";
import VendorDashboard from "../pages/vendor/VendorDashboard";
import VendorProducts from "../pages/vendor/VendorProducts";
import VendorOrders from "../pages/vendor/VendorOrders";

import AdminLogin from "../pages/admin/AdminLogin";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminVendors from "../pages/admin/AdminVendors";
import AdminProducts from "../pages/admin/AdminProducts";
import AdminCategories from "../pages/admin/AdminCategories";
import AdminOrders from "../pages/admin/AdminOrders";

import ScrollToTop from "../components/ScrollToTop";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Routes>
        <Route element={<UserLayout />}>
          <Route path="/" element={<HomeRoute />} />

          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/vendor/login" element={<VendorLogin />} />
            <Route path="/vendor/register" element={<VendorRegister />} />
            <Route path="/admin/login" element={<AdminLogin />} />
          </Route>

          <Route path="/category/:categoryId" element={<CategoryProducts />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/products/:id" element={<ProductDetails />} />

          <Route element={<ProtectedRoute allowedRole="user" />}>
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />

            <Route path="/account" element={<AccountLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="addresses" element={<SavedAddresses />} />
              <Route path="orders" element={<MyOrders />} />
              <Route path="orders/:id" element={<MyOrderDetails />} />
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
          <Route path="/vendor/dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/products" element={<VendorProducts />} />
          <Route path="/vendor/orders" element={<VendorOrders />} />
        </Route>

        <Route element={<ProtectedRoute allowedRole="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/vendors" element={<AdminVendors />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
