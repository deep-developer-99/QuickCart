import api from "./api";
import type { PromotionalBanner } from "../types/promotionalBanner";

export const getPromotionalBanners = async () => {
  const response = await api.get<{ success: boolean; data: PromotionalBanner[] }>("/promotional-banners");
  return response.data;
};

export const getAdminPromotionalBanners = async () => {
  const response = await api.get<{ success: boolean; data: PromotionalBanner[] }>("/admin/promotional-banners");
  return response.data;
};

export const savePromotionalBanner = async (data: FormData, id?: string) => {
  const response = await api.request({ method: id ? "put" : "post", url: id ? `/admin/promotional-banners/${id}` : "/admin/promotional-banners", data });
  return response.data;
};

export const deletePromotionalBanner = async (id: string) => (await api.delete(`/admin/promotional-banners/${id}`)).data;
export const togglePromotionalBanner = async (id: string) => (await api.put(`/admin/promotional-banners/${id}/status`)).data;
