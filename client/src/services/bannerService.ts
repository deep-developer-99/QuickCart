import api from "./api";

export const getActiveBanners = async () => {
  const response = await api.get("/banners");
  return response.data;
};

export const getAdminBanners = async () => {
  const response = await api.get("/admin/banners");
  return response.data;
};

export const createAdminBanner = async (bannerData: FormData) => {
  const response = await api.post("/admin/banners", bannerData);
  return response.data;
};

export const updateAdminBanner = async (id: string, bannerData: FormData) => {
  const response = await api.put(`/admin/banners/${id}`, bannerData);
  return response.data;
};

export const deleteAdminBanner = async (id: string) => {
  const response = await api.delete(`/admin/banners/${id}`);
  return response.data;
};

export const toggleAdminBannerStatus = async (id: string) => {
  const response = await api.put(`/admin/banners/${id}/status`);
  return response.data;
};
