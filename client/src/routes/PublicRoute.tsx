import { Navigate, Outlet } from "react-router-dom";

import { useAppSelector } from "../hooks/reduxHooks";

const getRoleHome = (role: "user" | "vendor" | "admin") => {
  if (role === "vendor") return "/vendor/dashboard";
  if (role === "admin") return "/admin/dashboard";

  return "/";
};

const PublicRoute = () => {
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth,
  );

  if (isLoading) {
    return <div>Loading.......</div>;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
