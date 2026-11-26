import api from "./api";
import type { PromotionalBanner } from "../types/promotionalBanner";
import { getPublicCached, invalidatePublicCache } from "./queryCache";
import { PUBLIC_CACHE_TTL_MS } from "./cachePolicy";

export const getPromotionalBanners = async () => {
  return getPublicCached<{ success: boolean; data: PromotionalBanner[] }>("/promotional-banners", {}, PUBLIC_CACHE_TTL_MS.banners, ["PromotionalBanners"]);
};

export const getAdminPromotionalBanners = async () => {
  const response = await api.get<{ success: boolean; data: PromotionalBanner[] }>("/admin/promotional-banners");
  return response.data;
};

export const savePromotionalBanner = async (data: FormData, id?: string) => {
  const response = await api.request({ method: id ? "put" : "post", url: id ? `/admin/promotional-banners/${id}` : "/admin/promotional-banners", data });
  if (response.data?.success) invalidatePublicCache(["PromotionalBanners"]);
  return response.data;
};

export const deletePromotionalBanner = async (id: string) => {
  const result = (await api.delete(`/admin/promotional-banners/${id}`)).data;
  if (result?.success) invalidatePublicCache(["PromotionalBanners"]);
  return result;
};
export const togglePromotionalBanner = async (id: string) => {
  const result = (await api.put(`/admin/promotional-banners/${id}/status`)).data;
  if (result?.success) invalidatePublicCache(["PromotionalBanners"]);
  return result;
};
