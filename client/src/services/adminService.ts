import api from "./api";

export const getAdminUsers = async (page = 1, limit = 10) => {
  const resposne = await api.get("/admin/users", { params: { page, limit } });

  return resposne.data;
};

export const getAdminVendors = async (page = 1, limit = 10) => {
  const resposne = await api.get("/admin/vendors", { params: { page, limit } });

  return resposne.data;
};

export const approveVendor = async (id: string) => {
  const resposne = await api.put(`/admin/vendors/${id}/approve`);

  return resposne.data;
};

export const rejectVendor = async (id: string) => {
  const resposne = await api.put(`/admin/vendors/${id}/reject`);

  return resposne.data;
};

export const deactivateVendor = async (id: string) => {
  const resposne = await api.put(`/admin/vendors/${id}/deactivate`);

  return resposne.data;
};

export const activateVendor = async (id: string) => {
  const resposne = await api.put(`/admin/vendors/${id}/activate`);

  return resposne.data;
};

export const getAdminProducts = async (page = 1, limit = 10) => {
  const resposne = await api.get("/admin/products", {
    params: { page, limit },
  });

  return resposne.data;
};

export const getAdminOrders = async (page = 1, limit = 10) => {
  const resposne = await api.get("/admin/orders", { params: { page, limit } });

  return resposne.data;
};

export const getAdminCategories = async (page = 1, limit = 10) => {
  const response = await api.get("/admin/categories", {
    params: { page, limit },
  });

  return response.data;
};

export const createAdminCategory = async (categoryData: FormData) => {
  const response = await api.post("/admin/categories", categoryData);

  return response.data;
};

export const updateAdminCategory = async (
  id: string,
  categoryData: FormData,
) => {
  const response = await api.put(`/admin/categories/${id}`, categoryData);

  return response.data;
};

export const deleteAdminCategory = async (id: string) => {
  const response = await api.delete(`/admin/categories/${id}`);

  return response.data;
};

export interface AdminSubcategoryFilters {
  page?: number;
  limit?: number;
  search?: string;
  parentCategory?: string;
  isActive?: "true" | "false";
}

export const getAdminSubcategories = async (filters: AdminSubcategoryFilters = {}) => {
  const response = await api.get("/admin/subcategories", { params: filters });
  return response.data;
};

export const createAdminSubcategory = async (
  data: FormData,
  onUploadProgress?: (progress: number) => void,
) => {
  const response = await api.post("/admin/subcategories", data, {
    onUploadProgress: (event) => {
      if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return response.data;
};

export const updateAdminSubcategory = async (
  id: string,
  data: FormData,
  onUploadProgress?: (progress: number) => void,
) => {
  const response = await api.put(`/admin/subcategories/${id}`, data, {
    onUploadProgress: (event) => {
      if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return response.data;
};

export const deleteAdminSubcategory = async (id: string) => {
  const response = await api.delete(`/admin/subcategories/${id}`);
  return response.data;
};
