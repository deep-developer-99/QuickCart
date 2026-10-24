import api from "./api";
import type {
  CustomerRecipient,
  ManualNotificationResult,
  ManagedNotification,
  ManagedOffer,
  PageInfo,
  PaginatedResponse,
  ResendResult,
} from "../types/notificationManagement";

export const getManagedOffers = async (page: number, limit = 10) => {
  const response = await api.get<PaginatedResponse<ManagedOffer>>("/offers/managed", {
    params: { page, limit },
  });
  return response.data;
};

export const createManagedOffer = async (body: {
  title: string;
  message: string;
  redirectType: "category" | "product";
  redirectValue: string;
}) => {
  const response = await api.post<{ success: boolean; data: ManagedOffer }>("/offers", body);
  return response.data;
};

export const updateOfferContent = async (offerId: string, body: { title: string; message: string }) => {
  const response = await api.put<{ success: boolean; data: ManagedOffer }>(`/offers/${offerId}`, body);
  return response.data;
};

export const publishManagedOffer = async (offerId: string) => {
  const response = await api.put<{ success: boolean; data: ManagedOffer }>(`/offers/${offerId}/publish`);
  return response.data;
};

export const deleteManagedOffer = async (offerId: string) => {
  const response = await api.delete<{ success: boolean; data: { id: string; deletedAt: string } }>(`/offers/${offerId}`);
  return response.data;
};

export const resendOfferNotification = async (offerId: string, idempotencyKey: string) => {
  const response = await api.post<{
    success: boolean;
    message: string;
    data: ResendResult;
  }>(`/offers/${offerId}/resend-notification`, undefined, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return response.data;
};

export const getEligibleRecipients = async (page: number, search: string, limit = 20) => {
  const response = await api.get<PaginatedResponse<CustomerRecipient>>("/notifications/recipients", {
    params: { page, limit, ...(search ? { search } : {}) },
  });
  return response.data;
};

export const sendManagedNotification = async (
  body:
    | {
        audience: "individual";
        kind: "custom";
        customerId: string;
        category: "general";
        title: string;
        message: string;
      }
    | {
        audience: "individual" | "all";
        kind: "offer";
        category: "offer";
        offerId: string;
        customerId?: string;
      },
  idempotencyKey: string,
) => {
  const response = await api.post<{ success: boolean; data: ManualNotificationResult }>(
    "/notifications/send",
    body,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
};

export const getManagedNotificationHistory = async (page: number, limit = 20) => {
  const response = await api.get<PaginatedResponse<ManagedNotification>>(
    "/notifications/managed/history",
    { params: { page, limit } },
  );
  return response.data;
};

export const deleteManagedNotification = async (notificationId: string) => {
  const response = await api.delete<{ success: boolean; data: { id: string; deletedAt: string } }>(
    `/notifications/managed/${notificationId}`,
  );
  return response.data;
};

export type { PageInfo };
