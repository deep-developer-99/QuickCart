import { Router } from "express";

import {
  registerVendorController,
  loginVendorController,
  loginAdminController,
  loginGoogleController,
  sendPhoneOtpController,
  verifyPhoneOtpController,
  logoutController,
  getMeController,
  updateProfileController,
  updateVendorShopLocationController,
  getVendorShopLocationController,
} from "../controllers/authController";
import authMiddleware from "../middleware/authMiddleware";
import upload from "../middleware/uploadMiddleware";

const router = Router();

router.post("/vendor/register", registerVendorController);
router.post("/vendor/login", loginVendorController);
router.post("/admin/login", loginAdminController);
router.post("/google", loginGoogleController);
router.post("/phone/send-otp", sendPhoneOtpController);
router.post("/phone/verify-otp", verifyPhoneOtpController);
router.post("/logout", logoutController);
router.get("/me", authMiddleware("user", "admin", "vendor"), getMeController);
router.put(
  "/vendor/shop-location",
  authMiddleware("vendor"),
  updateVendorShopLocationController,
);
router.get(
  "/vendor/shop-location",
  authMiddleware("vendor"),
  getVendorShopLocationController,
);
router.put(
  "/profile",
  authMiddleware("user"),
  upload.single("profileImage"),
  updateProfileController,
);

export default router;
