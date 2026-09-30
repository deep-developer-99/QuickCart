import { Navigate, Outlet } from "react-router-dom";

import { useAppSelector } from "../hooks/reduxHooks";
import NotificationBell from "../components/common/NotificationBell";
import VendorSidebar from "../components/vendor/VendorSidebar";
import AdminSidebar from "../components/admin/AdminSidebar";

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

    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  if (allowedRole === "vendor") {
    return (
      <div className="vendor-protected-shell">
        <VendorSidebar />
        <main className="vendor-protected-content">
          <NotificationBell />
          <Outlet />
        </main>
      </div>
    );
  }

  if (allowedRole === "admin") {
    return (
      <div className="admin-protected-shell">
        <AdminSidebar />
        <main className="admin-protected-content">
          <NotificationBell />
          <Outlet />
        </main>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
