import { BrowserRouter, Route, Routes } from "react-router-dom";

import HomeRoute from "./HomeRoute";
import PublicRoute from "./PublicRoute";
import ProtectedRoute from "./ProtectedRoute";
import UserLayout from "../layouts/UserLayout";

import Login from "../pages/user/Login";
import Products from "../pages/user/Products";
import ProductDetails from "../pages/user/ProductDetails";
import Cart from "../pages/user/Cart";
import Checkout from "../pages/user/Checkout";
import MyOrders from "../pages/user/MyOrders";
import MyOrderDetails from "../pages/user/MyOrderDetails";
import OrderConfirmation from "../pages/user/OrderConfirmation";
import Profile from "../pages/user/Profile";

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
          </Route>

          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetails />} />

          <Route element={<ProtectedRoute allowedRole="user" />}>
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/my-orders/:id" element={<MyOrderDetails />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/me" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<PublicRoute />}>
          <Route path="/vendor/login" element={<VendorLogin />} />
          <Route path="/vendor/register" element={<VendorRegister />} />
          <Route path="/admin/login" element={<AdminLogin />} />
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
          <Route path="/admin/orders" element={<AdminOrders />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
