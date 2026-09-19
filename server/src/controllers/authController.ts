import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import User from "../models/User";
import Vendor from "../models/Vendor";
import Admin from "../models/Admin";
import {
  registerVendor,
  loginVendor,
  loginAdmin,
  loginGoogleUser,
  sendPhoneOtpService,
  verifyPhoneOtpService,
} from "../services/authService";

// Vender Registration

export const registerVendorController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await registerVendor(req.body);

    res.status(201).json({
      success: true,
      message: "Vendor registered successfully. Waiting for admin approval.",
    });
  } catch (error) {
    console.error("Vendor registration error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Vendor registration failed",
    });
  }
};

// Vendor Login

export const loginVendorController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await loginVendor(email, password);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Vendor login successful",
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
    });
  } catch (error) {
    console.error("Vendor login error:", error);

    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Vendor login failed",
    });
  }
};

// Admin Login
export const loginAdminController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await loginAdmin(email, password);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Admin login failed",
    });
  }
};

// Google User Login
export const loginGoogleController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
      return;
    }

    const result = await loginGoogleUser(credential);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);

    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Google login failed",
    });
  }
};

// Send Phone OTP
export const sendPhoneOtpController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
      return;
    }

    const result = await sendPhoneOtpService(phone);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send OTP",
    });
  }
};

// Verify Phone OTP
export const verifyPhoneOtpController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { phone, code, name } = req.body;

    if (!phone || !code) {
      res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
      return;
    }

    const result = await verifyPhoneOtpService(phone, code, name);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Phone login successful",
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        phone,
        role: result.role,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    res.status(401).json({
      success: false,
      message:
        error instanceof Error ? error.message : "OTP verification failed",
    });
  }
};

// Logout
export const logoutController = (req: Request, res: Response): void => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logout Successful",
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Logout failed",
    });
  }
};

// Get Current User
export const getMeController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      console.log(req.user);
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    let user;

    if (req.user.role === "user") {
      user = await User.findById(req.user.id).select("-__v");
    } else if (req.user.role === "vendor") {
      user = await Vendor.findById(req.user.id).select("-password -__v");
    } else {
      user = await Admin.findById(req.user.id).select("-password -__v");
    }

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Account not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get me error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch account",
    });
  }
};

// Update User Profile
export const updateProfileController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "user") {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { name, phone } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Name is required",
      });
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";

    if (trimmedName.length < 2) {
      res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters long",
      });
      return;
    }

    if (trimmedPhone && !/^\+?[0-9]{10,15}$/.test(trimmedPhone)) {
      res.status(400).json({
        success: false,
        message: "Please enter a valid phone number",
      });
      return;
    }

    if (trimmedPhone) {
      const existingUser = await User.findOne({
        phone: trimmedPhone,
        _id: { $ne: req.user.id },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "This phone number is already registered",
        });
        return;
      }
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    user.name = trimmedName;

    if (trimmedPhone) {
      user.phone = trimmedPhone;
    } else {
      user.phone = undefined;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};
