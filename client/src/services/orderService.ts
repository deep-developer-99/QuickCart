import api from "./api";
import type { PaymentMethod } from "../types/order";

export const createOrder = async (
  addressId: string,
  paymentMethod: PaymentMethod,
  donationSelected = false,
  items: Array<{ productId: string; variantId: string; quantity: number }> = [],
  expectedTotal?: number,
) => {
  const response = await api.post("/orders", {
    addressId,
    paymentMethod,
    donationSelected,
    items,
    expectedTotal,
  });

  return response.data;
};

export interface CheckoutSummary {
  subtotal: number;
  shippingAmount: number;
  donationAmount?: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    variantId: string;
    name: string;
    image?: string;
    variantQuantity: number;
    variantUnit: string;
    quantity: number;
    price: number;
    discountPrice?: number;
    sellingPrice: number;
    itemTotal: number;
  }>;
}

export const getCheckoutSummary = async (donationSelected = false, items: Array<{ productId: string; variantId: string; quantity: number }> = []): Promise<{
  success: boolean;
  data?: CheckoutSummary;
  message?: string;
}> => {
  const response = await api.post("/orders/checkout-summary", { donationSelected, items });
  return response.data;
};

export const createRazorpayOrder = async (addressId: string, donationSelected = false, items: Array<{ productId: string; variantId: string; quantity: number }> = [], expectedTotal?: number) => {
  const response = await api.post("/orders/razorpay/create-order", {
    addressId,
    donationSelected,
    items,
    expectedTotal,
  });

  return response.data;
};

export interface VerifyRazorpayPaymentData {
  addressId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  donationSelected?: boolean;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  expectedTotal?: number;
}

export const verifyRazorpayPayment = async (
  data: VerifyRazorpayPaymentData,
) => {
  const response = await api.post("/orders/razorpay/verify", data);

  return response.data;
};

export const getMyOrders = async (page = 1, limit = 10) => {
  const response = await api.get("/orders/my-orders", { params: { page, limit } });
  return response.data;
};

export const getOrderById = async (id: string) => {
  const response = await api.get(`/orders/${id}`);
  return response.data;
};

export const getVendorOrders = async (page = 1, limit = 10) => {
  const response = await api.get("/orders/vendor", { params: { page, limit } });
  return response.data;
};

export const getVendorDashboard = async () => {
  const response = await api.get("/orders/vendor/dashboard");
  return response.data;
};

export const getVendorSalesOverview = async (
  period: "7d" | "30d" | "90d" = "30d",
) => {
  const response = await api.get("/orders/vendor/sales-overview", {
    params: { period },
  });

  return response.data;
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  const response = await api.put(`/orders/${orderId}/status`, { status });
  return response.data;
};
