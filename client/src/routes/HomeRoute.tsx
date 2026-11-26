import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";

import HomeShimmer from "../components/user/HomeShimmer";
import { useAppSelector } from "../hooks/reduxHooks";

const Home = lazy(() => import("../pages/user/Home"));

const HomeRoute = () => {
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth,
  );

  if (isLoading) {
    return <HomeShimmer />;
  }

  if (isAuthenticated && user) {
    if (user.role === "vendor") {
      return <Navigate to="/vendor/dashboard" replace />;
    }

    if (user.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <Suspense fallback={<HomeShimmer />}><Home /></Suspense>;
};

export default HomeRoute;
