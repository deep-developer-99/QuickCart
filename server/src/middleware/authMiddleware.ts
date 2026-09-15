import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import User from "../models/User";
import Vendor from "../models/Vendor";
import Admin from "../models/Admin";

interface JwtPayload {
  id: string;
  role: "user" | "vendor" | "admin";
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Get token from cookie
    const token = req.cookies.token;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // 2. Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as JwtPayload;

    // 3. Handle User
    if (decoded.role === "user") {
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        res.status(401).json({
          success: false,
          message: "User account not found",
        });
        return;
      }

      req.user = {
        id: user._id.toString(),
        role: "user",
      };

      next();
      return;
    }

    // 4. Handle Vendor
    if (decoded.role === "vendor") {
      const vendor = await Vendor.findById(decoded.id).select("-password");

      if (!vendor) {
        res.status(401).json({
          success: false,
          message: "Vendor account not found",
        });
        return;
      }

      if (vendor.status !== "approved") {
        res.status(403).json({
          success: false,
          message: "Vendor account is not approved",
        });
        return;
      }

      if (!vendor.isActive) {
        res.status(403).json({
          success: false,
          message: "Vendor account is inactive",
        });
        return;
      }

      req.user = {
        id: vendor._id.toString(),
        role: "vendor",
      };

      next();
      return;
    }

    // 5. Handle Admin
    if (decoded.role === "admin") {
      const admin = await Admin.findById(decoded.id).select("-password");

      if (!admin) {
        res.status(401).json({
          success: false,
          message: "Admin account not found",
        });
        return;
      }

      if (!admin.isActive) {
        res.status(403).json({
          success: false,
          message: "Admin account is inactive",
        });
        return;
      }

      req.user = {
        id: admin._id.toString(),
        role: "admin",
      };

      next();
      return;
    }

    res.status(401).json({
      success: false,
      message: "Invalid user role",
    });
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default authMiddleware;
