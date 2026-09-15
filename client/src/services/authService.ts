import api from "./api";

export interface VendorRegisterData {
  name: string;
  email: string;
  password: string;
  shopName: string;
  phone?: string;
  address?: string;
}

export interface VendorLoginData {
  email: string;
  password: string;
}

export interface AdminLoginData {
  email: string;
  password: string;
}

export interface PhoneOtpData {
  phone: string;
}

export interface VerifyPhoneOtpData {
  phone: string;
  code: string;
  name?: string;
}

export const registerVendor = async (data: VendorRegisterData) => {
  const response = await api.post("/auth/vendor/register", data);

  return response.data;
};

export const loginVendor = async (data: VendorLoginData) => {
  const response = await api.post("/auth/vendor/login", data);

  return response.data;
};

export const loginAdmin = async (data: AdminLoginData) => {
  const response = await api.post("/auth/admin/login", data);

  return response.data;
};

export const sendPhoneOtp = async (data: PhoneOtpData) => {
  const response = await api.post("/auth/phone/send-otp", data);

  return response.data;
};

export const verifyPhoneOtp = async (data: VerifyPhoneOtpData) => {
  const response = await api.post("/auth/phone/verify-otp", data);

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");

  return response.data;
};

export const logout = async () => {
  const response = await api.post("/auth/logout");

  return response.data;
};
