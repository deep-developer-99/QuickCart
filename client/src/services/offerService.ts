import api from "./api";
import type { Offer } from "../types/offer";

export interface OfferInput {
  title: string;
  message: string;
  redirectType: "category" | "product";
  redirectValue: string;
}

export const getAdminOffers = async (page = 1, limit = 10) => {
  const response = await api.get<{ success: boolean; data: Offer[]; pagination: { totalPages: number; totalItems: number } }>(
    "/admin/offers",
    { params: { page, limit } },
  );
  return response.data;
};

export const createAdminOffer = async (data: OfferInput) => {
  const response = await api.post<{ success: boolean; data: Offer }>("/admin/offers", data);
  return response.data;
};

export const updateAdminOffer = async (id: string, data: OfferInput) => {
  const response = await api.put<{ success: boolean; data: Offer }>(`/admin/offers/${id}`, data);
  return response.data;
};

export const publishAdminOffer = async (id: string) => {
  const response = await api.put<{ success: boolean; data: Offer }>(`/admin/offers/${id}/publish`);
  return response.data;
};
