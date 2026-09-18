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
