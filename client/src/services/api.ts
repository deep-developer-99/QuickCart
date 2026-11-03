import axios from "axios";

const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiBaseUrl = configuredApiBaseUrl
  ? /\/api$/i.test(configuredApiBaseUrl.replace(/\/+$/, ""))
    ? configuredApiBaseUrl.replace(/\/+$/, "")
    : `${configuredApiBaseUrl.replace(/\/+$/, "")}/api`
  : "/api";

const api = axios.create({
  baseURL: normalizedApiBaseUrl,
  withCredentials: true,
});

export default api;
