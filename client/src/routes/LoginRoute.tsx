import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useLoginModal } from "../context/LoginModalContext";

const safeCustomerPath = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.startsWith("/vendor") || value.startsWith("/admin") || value === "/login") return undefined;
  return value;
};

const LoginRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    const state = location.state as { from?: string | { pathname?: string; search?: string; hash?: string } } | null;
    const from = typeof state?.from === "string"
      ? state.from
      : state?.from?.pathname
        ? `${state.from.pathname}${state.from.search || ""}${state.from.hash || ""}`
        : undefined;
    openLoginModal({ returnTo: safeCustomerPath(from) });
    navigate("/", { replace: true });
  }, [location.state, navigate, openLoginModal]);

  return null;
};

export default LoginRoute;
