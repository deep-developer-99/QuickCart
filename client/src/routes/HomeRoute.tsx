import { Navigate } from "react-router-dom";

import Home from "../pages/user/Home";
import { useAppSelector } from "../hooks/reduxHooks";

const HomeRoute = () => {
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth,
  );

  if (isLoading) {
    return <div>Loading.......</div>;
  }

  if (isAuthenticated && user) {
    if (user.role === "vendor") {
      return <Navigate to="/vendor/dashboard" replace />;
    }

    if (user.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <Home />;
};

export default HomeRoute;
