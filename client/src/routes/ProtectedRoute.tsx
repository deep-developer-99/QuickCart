import { Navigate, Outlet } from "react-router-dom";

import { useAppSelector } from "../hooks/reduxHooks";

interface ProtectedRouteProps {
  allowedRole: "user" | "vendor" | "admin";
}

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
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
