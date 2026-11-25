import axios from "axios";
import { store } from "../store/store";
import { finalizeLocalLogout } from "./authSession";
import { signOutFirebaseAuth } from "./firebaseAuthService";
import { isPublicReadRequest, shouldCancelForAuthChange } from "./authRequestPolicy";

const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiBaseUrl = configuredApiBaseUrl
  ? /\/api$/i.test(configuredApiBaseUrl.replace(/\/+$/, ""))
    ? configuredApiBaseUrl.replace(/\/+$/, "")
    : `${configuredApiBaseUrl.replace(/\/+$/, "")}/api`
  : "/api";

const api = axios.create({ baseURL: normalizedApiBaseUrl, withCredentials: true });
const owners = new WeakMap<object, { userId: string | null; revision: number }>();

const isAuthEndpoint = (url?: string) => /\/auth\/(?:logout|google|admin\/login|vendor\/login|vendor\/register|phone\/send-otp|phone\/verify-otp)(?:\?|$)/.test(url ?? "");
const expireCurrentSession = (deactivatedUserId?: string) => {
  finalizeLocalLogout(true, deactivatedUserId);
  void signOutFirebaseAuth().catch((error: unknown) => {
    console.error("Firebase sign-out after QuickCart session expiration failed:", error);
  });
};

api.interceptors.request.use((config) => {
  const auth = store.getState().auth;
  owners.set(config, { userId: auth.user?.id ?? null, revision: auth.revision });
  return config;
});
api.interceptors.response.use((response) => {
  const owner = owners.get(response.config);
  const auth = store.getState().auth;
  if (shouldCancelForAuthChange(owner, { userId: auth.user?.id ?? null, revision: auth.revision }, response.config.method, response.config.url)) {
    throw new axios.CanceledError("Account changed while the request was in progress.");
  }
  return response;
}, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config
    && !isPublicReadRequest(error.config.method, error.config.url)
    && !isAuthEndpoint(error.config.url)) {
    const owner = owners.get(error.config);
    const auth = store.getState().auth;
    if (owner?.userId && owner.userId === auth.user?.id && owner.revision === auth.revision) {
      const deactivatedUserId = error.response.data?.code === "ACCOUNT_INACTIVE" && auth.user.role === "user"
        ? auth.user.id
        : undefined;
      expireCurrentSession(deactivatedUserId);
    }
  }
  return Promise.reject(error);
});

export default api;
