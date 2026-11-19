import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAppSelector } from "../hooks/reduxHooks";
import NotificationBell from "../components/common/NotificationBell";
import VendorSidebar from "../components/vendor/VendorSidebar";
import AdminSidebar from "../components/admin/AdminSidebar";
import "../layouts/ManagementLayout.css";

interface ProtectedRouteProps {
  allowedRole: "user" | "vendor" | "admin";
}

const getRoleHome = (role: "user" | "vendor" | "admin") => {
  if (role === "vendor") return "/vendor/dashboard";
  if (role === "admin") return "/admin/dashboard";

  return "/";
};

const ProtectedRoute = ({ allowedRole }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth,
  );
  const location = useLocation();

  if (isLoading) {
    return <div>Loading.......</div>;
  }

  if (!isAuthenticated || !user) {
    if (allowedRole === "vendor") {
      return <Navigate to="/vendor/login" replace />;
    }

    if (allowedRole === "admin") {
      return <Navigate to="/admin/login" replace />;
    }

    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  if (allowedRole !== "user") {
    return (
      <div className="management-shell">
        {allowedRole === "admin" ? <AdminSidebar /> : <VendorSidebar />}
        <NotificationBell />
        <main className="management-content">
          <Outlet />
        </main>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
