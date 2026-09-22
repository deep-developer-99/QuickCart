import { Navigate, Outlet } from "react-router-dom";

import { useAppSelector } from "../hooks/reduxHooks";
import NotificationBell from "../components/common/NotificationBell";

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

  return (
    <>
      {(allowedRole === "vendor" || allowedRole === "admin") && (
        <NotificationBell />
      )}
      <Outlet />
    </>
  );
};

export default ProtectedRoute;
