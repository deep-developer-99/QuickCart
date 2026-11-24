import api from "./api";

export interface NavigationCategory { _id: string; name: string; image?: string; isActive: boolean }
export interface NavigationItem { categoryId: string; category?: NavigationCategory | null; displayName: string; icon: string; iconPublicId?: string; isActive: boolean; displayOrder: number }
export interface NavigationData { revision: number; categories: NavigationCategory[]; items: NavigationItem[] }

export const getAdminMobileNavigation = async (): Promise<NavigationData> =>
  (await api.get<{ success: boolean; data: NavigationData }>("/admin/mobile-category-navigation")).data.data;

export const saveAdminMobileNavigation = async (revision: number, items: NavigationItem[]): Promise<NavigationData> =>
  (await api.put<{ success: boolean; data: NavigationData }>("/admin/mobile-category-navigation", {
    revision,
    items: items.map(({ categoryId, displayName, icon, iconPublicId, isActive }) => ({ categoryId, displayName, icon, iconPublicId, isActive })),
  })).data.data;

export const uploadMobileNavigationIcon = async (file: File): Promise<{ icon: string; iconPublicId: string }> => {
  const data = new FormData(); data.append("icon", file);
  return (await api.post<{ success: boolean; data: { icon: string; iconPublicId: string } }>("/admin/mobile-category-navigation/icon", data)).data.data;
};

export const deleteUnusedMobileNavigationIcon = async (publicId: string): Promise<void> => {
  await api.delete("/admin/mobile-category-navigation/icon", { data: { publicId } });
};
