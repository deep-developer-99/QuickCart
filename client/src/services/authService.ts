import api from "./api";
import { finalizeLocalLogout } from "./authSession";
import { signOutFirebaseAuth } from "./firebaseAuthService";

export class LogoutServiceError extends Error {
  readonly backendLoggedOut: boolean;

  constructor(message: string, backendLoggedOut: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "LogoutServiceError";
    this.backendLoggedOut = backendLoggedOut;
  }
}

export interface VendorRegisterData {
  name: string;
  email: string;
  password: string;
  shopName: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
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

// Google Firebase Login
export const loginWithFirebaseGoogle = async (idToken: string) => {
  try {
    const response = await api.post("/auth/google", { idToken });
    return response.data;
  } finally {
    // Firebase proves the Google identity; QuickCart owns the ongoing session.
    try {
      await signOutFirebaseAuth();
    } catch (error) {
      console.error("Firebase sign-out after Google authentication failed:", error);
    }
  }
};

export const getCurrentUser = async (config?: { timeout: number }) => {
  const response = await api.get("/auth/me", config);

  return response.data;
};

export interface UpdateVendorShopLocationData {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export const getVendorShopLocation = async () => {
  const response = await api.get("/auth/vendor/shop-location");
  return response.data;
};

export const updateVendorShopLocation = async (
  data: UpdateVendorShopLocationData,
) => {
  const response = await api.put("/auth/vendor/shop-location", data);
  return response.data;
};

export const logout = async () => {
  const [backendResult, firebaseResult] = await Promise.allSettled([
    api.post("/auth/logout"),
    signOutFirebaseAuth(),
  ]);

  if (backendResult.status === "rejected" || backendResult.value.data?.success !== true) {
    const reason = backendResult.status === "rejected" ? backendResult.reason : undefined;
    throw new LogoutServiceError(
      reason instanceof Error ? reason.message : "QuickCart logout failed; the server session may still be active.",
      false,
      reason instanceof Error ? { cause: reason } : undefined,
    );
  }

  finalizeLocalLogout();
  if (firebaseResult.status === "rejected") {
    throw new LogoutServiceError("QuickCart session ended, but Firebase cleanup failed.", true, { cause: firebaseResult.reason });
  }
  return backendResult.value.data;
};

export interface UpdateProfileData {
  phoneCode?: string;
  name: string;
  phone?: string;
  profileImage?: File;
}

export const updateProfile = async (data: UpdateProfileData) => {
  const formData = new FormData();
  formData.append("name", data.name);
  if (data.phoneCode) formData.append("phoneCode", data.phoneCode);

  if (data.phone) {
    formData.append("phone", data.phone);
  }

  if (data.profileImage) {
    formData.append("profileImage", data.profileImage);
  }

  const response = await api.put("/auth/profile", formData);
  return response.data;
};
