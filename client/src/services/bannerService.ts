import api from "./api";
import { getPublicCached, invalidatePublicCache } from "./queryCache";
import { PUBLIC_CACHE_TTL_MS } from "./cachePolicy";
import type { Banner } from "../types/banner";

export const getActiveBanners = async () => {
  return getPublicCached<{ success: boolean; data: Banner[] }>("/banners", {}, PUBLIC_CACHE_TTL_MS.banners, ["Banners"]);
};

export const getAdminBanners = async (page = 1, limit = 10) => {
  const response = await api.get("/admin/banners", { params: { page, limit } });
  return response.data;
};

export const createAdminBanner = async (bannerData: FormData) => {
  const response = await api.post("/admin/banners", bannerData);
  if (response.data?.success) invalidatePublicCache(["Banners"]);
  return response.data;
};

export const updateAdminBanner = async (id: string, bannerData: FormData) => {
  const response = await api.put(`/admin/banners/${id}`, bannerData);
  if (response.data?.success) invalidatePublicCache(["Banners"]);
  return response.data;
};

export const deleteAdminBanner = async (id: string) => {
  const response = await api.delete(`/admin/banners/${id}`);
  if (response.data?.success) invalidatePublicCache(["Banners"]);
  return response.data;
};

export const toggleAdminBannerStatus = async (id: string) => {
  const response = await api.put(`/admin/banners/${id}/status`);
  if (response.data?.success) invalidatePublicCache(["Banners"]);
  return response.data;
};
