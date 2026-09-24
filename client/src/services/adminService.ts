import api from "./api";

export const getAdminUsers = async () => {
  const resposne = await api.get("/admin/users");

  return resposne.data;
};

export const getAdminVendors = async () => {
  const resposne = await api.get("/admin/vendors");

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

export const getAdminProducts = async () => {
  const resposne = await api.get("/admin/products");

  return resposne.data;
};

export const getAdminOrders = async () => {
  const resposne = await api.get("/admin/orders");

  return resposne.data;
};

export const getAdminCategories = async () => {
  const response = await api.get("/admin/categories");

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
