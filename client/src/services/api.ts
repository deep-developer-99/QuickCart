import axios from "axios";
import { store } from "../store/store";
import { logoutUser } from "../store/slice/authSlice";
import { clearDeactivatedCustomerStorage } from "../utils/customerSession";

const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiBaseUrl = configuredApiBaseUrl
  ? /\/api$/i.test(configuredApiBaseUrl.replace(/\/+$/, ""))
    ? configuredApiBaseUrl.replace(/\/+$/, "")
    : `${configuredApiBaseUrl.replace(/\/+$/, "")}/api`
  : "/api";

const api = axios.create({ baseURL: normalizedApiBaseUrl, withCredentials: true });
const owners = new WeakMap<object, string | null>();

api.interceptors.request.use((config) => {
  owners.set(config, store.getState().auth.user?.id ?? null);
  return config;
});
api.interceptors.response.use((response) => {
  const owner = owners.get(response.config);
  if (owner !== (store.getState().auth.user?.id ?? null)) {
    throw new axios.CanceledError("Account changed while the request was in progress.");
  }
  return response;
}, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.response.data?.code === "ACCOUNT_INACTIVE") {
    const current = store.getState().auth.user;
    if (current && owners.get(error.config!) === current.id) {
      clearDeactivatedCustomerStorage(current.id);
      store.dispatch(logoutUser());
    }
  }
  return Promise.reject(error);
});

export default api;
