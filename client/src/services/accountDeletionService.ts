import axios from "axios";
import api from "./api";

const options = { headers: { "X-QuickCart-Account": "delete" } };
const confirmationCacheMs = 4 * 60 * 1000;
let confirmationCache: { token: string; expiresAt: number } | null = null;
let confirmationRequest: Promise<string> | null = null;

export const clearAccountDeletionConfirmation = () => {
  confirmationCache = null;
  confirmationRequest = null;
};

export const getConfirmationRetryAfterSeconds = (error: unknown): number | null => {
  if (!api.defaults) return null;
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return null;
  const body = error.response.data as { retryAfterSeconds?: unknown } | undefined;
  const bodySeconds = typeof body?.retryAfterSeconds === "number"
    ? body.retryAfterSeconds
    : Number(body?.retryAfterSeconds);
  if (Number.isFinite(bodySeconds) && bodySeconds >= 0) return Math.max(1, Math.ceil(bodySeconds));
  const header = error.response.headers?.["retry-after"];
  const headerSeconds = typeof header === "string" ? Number(header) : NaN;
  if (Number.isFinite(headerSeconds) && headerSeconds >= 0) return Math.max(1, Math.ceil(headerSeconds));
  if (typeof header === "string") {
    const dateSeconds = (Date.parse(header) - Date.now()) / 1000;
    if (Number.isFinite(dateSeconds) && dateSeconds >= 0) return Math.max(1, Math.ceil(dateSeconds));
  }
  return 5;
};

export const getAccountDeletionConfirmation = async () => {
  if (confirmationCache && confirmationCache.expiresAt > Date.now()) return confirmationCache.token;
  confirmationCache = null;
  if (confirmationRequest) return confirmationRequest;
  confirmationRequest = api.post<{ success: boolean; confirmationToken: string }>("/auth/delete-account/confirmation", {}, options)
    .then((response) => {
      if (!response.data.success || !response.data.confirmationToken) throw new Error("Confirmation could not be loaded.");
      confirmationCache = {
        token: response.data.confirmationToken,
        expiresAt: Date.now() + confirmationCacheMs,
      };
      return response.data.confirmationToken;
    })
    .finally(() => { confirmationRequest = null; });
  return confirmationRequest;
};

export const deleteAccount = async (reason: string, feedback: string, confirmationToken: string) => {
  const response = await api.post<{ success: boolean }>("/auth/delete-account", { reason, feedback, confirmationToken }, options);
  if (!response.data.success) throw new Error("Account deletion could not be confirmed.");
  clearAccountDeletionConfirmation();
};
