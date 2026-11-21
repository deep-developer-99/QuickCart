import { resolveGoogleCustomer, resolvePhoneCustomer } from "./customerIdentityService";
import { activeCustomerFilter, normalizeCustomerPhone } from "../utils/customerLifecycle";
import bcrypt from "bcryptjs";
import { sendPhoneOtp, verifyPhoneOtp } from "./twilioService";
import { firebaseAdminAuth } from "../config/firebaseAdmin";

import User from "../models/User";
import Vendor from "../models/Vendor";
import Admin from "../models/Admin";

import generateToken from "../utils/jwt";
import { notifyAdminsAboutNewVendor } from "./notificationService";

interface LoginResponse {
  id: string;
  name: string;
  email: string;
  role: "user" | "vendor" | "admin";
  profileImage?: string;
  phone?: string;
  token: string;
}

interface VendorRegisterData {
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

// VENDOR REGISTRATION

export const registerVendor = async (
  data: VendorRegisterData,
): Promise<void> => {
  const {
    name,
    email,
    password,
    shopName,
    phone,
    address,
    city,
    state,
    pincode,
  } = data;
  const { latitude, longitude } = data;

  if (
    typeof address !== "string" ||
    !address.trim() ||
    typeof city !== "string" ||
    !city.trim() ||
    typeof state !== "string" ||
    !state.trim() ||
    typeof pincode !== "string" ||
    !/^\d{6}$/.test(pincode.trim())
  ) {
    throw new Error("Enter the complete shop address, city, state, and 6-digit postal code");
  }
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Select a valid shop location on the map before registering");
  }

  const existingVendor = await Vendor.findOne({ email });

  if (existingVendor) {
    throw new Error("Vendor with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const shopCoordinates = { latitude, longitude };

  const vendor = await Vendor.create({
    name,
    email,
    password: hashedPassword,
    shopName,
    phone,
    address,
    city: city?.trim(),
    state: state?.trim(),
    pincode: pincode?.trim(),
    ...shopCoordinates,
    isApproved: false,
    isActive: true,
    status: "pending",
    role: "vendor",
  });

  try {
    await notifyAdminsAboutNewVendor(name, shopName, vendor._id.toString());
  } catch (notificationError) {
    console.error("New vendor notification error:", notificationError);
  }
};

// VENDOR LOGIN

export const loginVendor = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const vendor = await Vendor.findOne({ email });

  if (!vendor) {
    throw new Error("Invalid email or password");
  }

  if (vendor.status !== "approved") {
    throw new Error("Vendor account is not approved");
  }

  if (!vendor.isActive) {
    throw new Error("Vendor account is inactive");
  }

  const isPasswordValid = await bcrypt.compare(password, vendor.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken({
    id: vendor._id.toString(),
    role: "vendor",
  });

  return {
    id: vendor._id.toString(),
    name: vendor.name,
    email: vendor.email,
    role: "vendor",
    token,
  };
};

// ADMIN LOGIN

export const loginAdmin = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const admin = await Admin.findOne({ email });

  if (!admin) {
    throw new Error("Invalid email or password");
  }

  if (!admin.isActive) {
    throw new Error("Admin account is inactive");
  }

  const isPasswordValid = await bcrypt.compare(password, admin.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken({
    id: admin._id.toString(),
    role: "admin",
  });

  return {
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    token,
  };
};

// GOOGLE USER LOGIN / REGISTRATION
export const loginGoogleUser = async (
  idToken: string,
): Promise<LoginResponse> => {
  if (!idToken) {
    throw new Error("Firebase ID token is required");
  }

  // Verify Firebase ID token
  const decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);

  const { uid: googleId, email, name, picture } = decodedToken;

  if (!googleId || !email) {
    throw new Error("Required Google user information is missing");
  }

  if (!decodedToken.email_verified || decodedToken.firebase?.sign_in_provider !== "google.com") {
    throw new Error("Please sign in with a verified Google account.");
  }
  const user = await resolveGoogleCustomer({ googleId, email, name, picture });
  // Generate QuickCart JWT
  const token = generateToken({
    id: user._id.toString(),
    role: "user",
    authTime: decodedToken.auth_time,
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    role: user.role,
    token,
  };
};

// Send Phone OTP
export const sendPhoneOtpService = async (
  phone: string,
): Promise<{ isNewUser: boolean }> => {
  const formattedPhone = normalizeCustomerPhone(phone);

  await sendPhoneOtp(formattedPhone);

  const existingUser = await User.findOne({
    phone: formattedPhone,
    ...activeCustomerFilter,
  });

  return {
    isNewUser: !existingUser,
  };
};

// Verify Phone OTP
export const verifyPhoneOtpService = async (
  phone: string,
  code: string,
  name?: string,
): Promise<LoginResponse> => {
  const formattedPhone = normalizeCustomerPhone(phone);

  const isVerified = await verifyPhoneOtp(formattedPhone, code);

  if (!isVerified) {
    throw new Error("Invalid or Expired OTP");
  }

  const user = await resolvePhoneCustomer(formattedPhone, name);

  const token = generateToken({
    id: user._id.toString(),
    role: "user",
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email ?? "",
    phone: user.phone,
    profileImage: user.profileImage,
    role: user.role,
    token,
  };
};
