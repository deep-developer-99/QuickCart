import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import User from "../models/User";
import Vendor from "../models/Vendor";
import Admin from "../models/Admin";

type Role = "user" | "vendor" | "admin";

interface JwtPayload {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

const authMiddleware = (...allowedRoles: Role[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // 1. Get JWT from cookie
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

      // 3. Check User
      if (decoded.role === "user") {
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
          res.status(401).json({
            success: false,
            message: "User account not found",
          });
          return;
        }

        // If specific roles are provided, check role
        if (allowedRoles.length > 0 && !allowedRoles.includes("user")) {
          res.status(403).json({
            success: false,
            message: "Access denied",
          });
          return;
        }

        req.user = {
          id: user._id.toString(),
          role: "user",
        };
      }

      // 4. Check Vendor
      else if (decoded.role === "vendor") {
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

        if (allowedRoles.length > 0 && !allowedRoles.includes("vendor")) {
          res.status(403).json({
            success: false,
            message: "Access denied",
          });
          return;
        }

        req.user = {
          id: vendor._id.toString(),
          role: "vendor",
        };
      }

      // 5. Check Admin
      else if (decoded.role === "admin") {
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

        if (allowedRoles.length > 0 && !allowedRoles.includes("admin")) {
          res.status(403).json({
            success: false,
            message: "Access denied",
          });
          return;
        }

        req.user = {
          id: admin._id.toString(),
          role: "admin",
        };
      }

      // 6. Invalid role
      else {
        res.status(401).json({
          success: false,
          message: "Invalid user role",
        });
        return;
      }

      // 7. Everything is valid
      next();
    } catch (error) {
      console.error("Authentication error:", error);

      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  };
};

export default authMiddleware;
