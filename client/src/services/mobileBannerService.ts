import api from "./api";

export type MobileBannerRedirectType = "none" | "category" | "subcategory" | "product";
export interface MobileBanner {
  _id: string;
  title: string;
  image: string;
  redirectType: MobileBannerRedirectType;
  redirectTarget?: string;
  displayOrder: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
}
export interface BannerCategory { _id: string; name: string; subcategories: Array<{ _id: string; name: string }> }
export interface BannerProduct { _id: string; name: string }

export const getAdminMobileBanners = async (): Promise<MobileBanner[]> =>
  (await api.get<{ success: boolean; data: MobileBanner[] }>("/admin/mobile-banners")).data.data;
export const createAdminMobileBanner = async (data: FormData): Promise<void> => {
  await api.post("/admin/mobile-banners", data);
};
export const updateAdminMobileBanner = async (id: string, data: FormData): Promise<void> => {
  await api.put(`/admin/mobile-banners/${id}`, data);
};
export const deleteAdminMobileBanner = async (id: string): Promise<void> => {
  await api.delete(`/admin/mobile-banners/${id}`);
};
export const setAdminMobileBannerStatus = async (id: string, isActive: boolean): Promise<void> => {
  await api.patch(`/admin/mobile-banners/${id}/status`, { isActive });
};
export const reorderAdminMobileBanners = async (ids: string[]): Promise<void> => {
  await api.put("/admin/mobile-banners/reorder", { ids });
};
export const getMobileBannerCategories = async (): Promise<BannerCategory[]> =>
  (await api.get<{ success: boolean; data: BannerCategory[] }>("/categories/catalog")).data.data;
export const searchMobileBannerProducts = async (search: string): Promise<BannerProduct[]> =>
  (await api.get<{ success: boolean; data: BannerProduct[] }>("/products", { params: { search, page: 1, limit: 30 } })).data.data;
