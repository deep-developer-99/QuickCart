import axios from "axios";
import { useStore } from "react-redux";

import { useLoginModal } from "../context/LoginModalContext";
import { getCurrentUser } from "../services/authService";
import { setCredentials } from "../store/slice/authSlice";
import type { RootState } from "../store/store";
import { normalizeAuthUser } from "../utils/normalizeAuthUser";

export const useCartLogin = (beforeLoginRequired?: () => void) => {
  const { openLoginRequired } = useLoginModal();
  const store = useStore<RootState>();

  return async (trigger?: HTMLElement) => {
    const requireLogin = () => {
      beforeLoginRequired?.();
      openLoginRequired(trigger);
      return false;
    };

    const { isAuthenticated, user } = store.getState().auth;
    if (!isAuthenticated || user?.role !== "user") return requireLogin();

    // The local cart cannot detect when the server's HTTP-only session expires.
    let sessionUser = null;
    try {
      const response = await getCurrentUser({ timeout: 5000 });
      sessionUser = response?.success ? normalizeAuthUser(response.data) : null;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 401 && status !== 403) throw error;
    }

    const currentAuth = store.getState().auth;
    if (!currentAuth.isAuthenticated || currentAuth.user?.role !== "user") return requireLogin();
    if (currentAuth.user !== user) return false;
    if (sessionUser?.role === "user" && sessionUser.id === user.id) return true;

    store.dispatch(setCredentials(sessionUser));
    // If the account changed, let the shopper confirm the add on their next click.
    return sessionUser?.role === "user" ? false : requireLogin();
  };
};
