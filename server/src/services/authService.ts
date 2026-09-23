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

  const normalizedEmail = email.toLowerCase().trim();

  // First search by Firebase Google UID
  let user = await User.findOne({
    googleId,
  });

  // If not found, search by email.
  // This prevents duplicate accounts when
  // the user already registered using phone.
  if (!user) {
    user = await User.findOne({
      email: normalizedEmail,
    });

    if (user) {
      user.googleId = googleId;

      if (picture && !user.profileImage) {
        user.profileImage = picture;
      }

      if (name && !user.name) {
        user.name = name;
      }

      await user.save();
    }
  }

  // Create new user
  if (!user) {
    user = await User.create({
      name: name?.trim() || "QuickCart User",
      email: normalizedEmail,
      googleId,
      profileImage: picture,
      role: "user",
    });
  }

  // Generate QuickCart JWT
  const token = generateToken({
    id: user._id.toString(),
    role: "user",
  });

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
