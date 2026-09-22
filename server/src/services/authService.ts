import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { sendPhoneOtp, verifyPhoneOtp } from "./twilioService";

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
  token: string;
}

interface VendorRegisterData {
  name: string;
  email: string;
  password: string;
  shopName: string;
  phone?: string;
  address?: string;
}

// Helper
const formatPhoneNumber = (phone: string): string => {
  const cleanedPhone = phone.trim();

  if (/^\d{10}$/.test(cleanedPhone)) {
    return `+91${cleanedPhone}`;
  }

  return cleanedPhone;
};

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// VENDOR REGISTRATION

export const registerVendor = async (
  data: VendorRegisterData,
): Promise<void> => {
  const { name, email, password, shopName, phone, address } = data;

  const existingVendor = await Vendor.findOne({ email });

  if (existingVendor) {
    throw new Error("Vendor with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const vendor = await Vendor.create({
    name,
    email,
    password: hashedPassword,
    shopName,
    phone,
    address,
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
  credential: string,
): Promise<LoginResponse> => {
  // 1. Verify Google credential
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  // 2. Get user information from Google
  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Invalid Google credential");
  }

  const { sub: googleId, name, email, picture } = payload;

  // 3. Make sure required information exists
  if (!googleId || !name || !email) {
    throw new Error("Required Google user information is missing");
  }

  // 4. Check whether user already exists
  let user = await User.findOne({ googleId });

  // 5. If user doesn't exist, create an account
  if (!user) {
    user = await User.create({
      name,
      email,
      googleId,
      profileImage: picture,
      role: "user",
    });
  }

  // 6. Generate QuickCart JWT
  const token = generateToken({
    id: user._id.toString(),
    role: "user",
  });

  // 7. Return user information
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  };
};

// Send Phone OTP
export const sendPhoneOtpService = async (
  phone: string,
): Promise<{ isNewUser: boolean }> => {
  const formattedPhone = formatPhoneNumber(phone);

  await sendPhoneOtp(formattedPhone);

  const existingUser = await User.findOne({
    phone: formattedPhone,
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
  const formattedPhone = formatPhoneNumber(phone);

  const isVerified = await verifyPhoneOtp(formattedPhone, code);

  if (!isVerified) {
    throw new Error("Invalid or Expired OTP");
  }

  // Check existing user
  let user = await User.findOne({ phone: formattedPhone });

  // New user
  if (!user) {
    if (!name?.trim()) {
      throw new Error("Name is required for first-time login");
    }

    user = await User.create({
      name: name.trim(),
      phone: formattedPhone,
      role: "user",
    });
  }

  const token = generateToken({
    id: user._id.toString(),
    role: "user",
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email ?? "",
    role: user.role,
    token,
  };
};
