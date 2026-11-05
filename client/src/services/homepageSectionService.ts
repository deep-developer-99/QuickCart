import api from "./api";
import type { AdminHomepageSection, AdminHomepageSectionData, HomepageSectionPreview } from "../types/homepageSection";

export const getHomepageSections = async (): Promise<{ success: boolean; data: HomepageSectionPreview[] }> => {
  const response = await api.get("/homepage-sections");
  return response.data;
};

export const getAdminHomepageSections = async (): Promise<{ success: boolean; data: AdminHomepageSectionData }> => {
  const response = await api.get("/admin/homepage-sections");
  return response.data;
};

export const saveAdminHomepageSections = async (sections: AdminHomepageSection[]) => {
  const response = await api.put("/admin/homepage-sections", {
    sections: sections.map(({ subCategoryId, isActive, productLimit }) => ({ subCategoryId, isActive, productLimit })),
  });
  return response.data as { success: boolean; data: AdminHomepageSectionData };
};
