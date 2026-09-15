import api from "./api";
import type { PaymentMethod } from "../types/order";

export const createOrder = async (
  addressId: string,
  paymentMethod: PaymentMethod,
) => {
  const response = await api.post("/orders", {
    addressId,
    paymentMethod,
  });

  return response.data;
};

export const getMyOrders = async () => {
  const response = await api.get("/orders/my-orders");

  return response.data;
};

export const getOrderById = async (id: string) => {
  const response = await api.get(`/orders/${id}`);

  return response.data;
};

export const getVendorOrders = async () => {
  const response = await api.get("/orders/vendor");

  return response.data;
};

export const getVendorDashboard = async () => {
  const response = await api.get("/orders/vendor/dashboard");

  return response.data;
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  const response = await api.put(`/orders/${orderId}/status`, { status });

  return response.data;
};
