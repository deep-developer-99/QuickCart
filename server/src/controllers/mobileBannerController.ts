import type { Request, Response } from "express";
import mongoose from "mongoose";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "../services/cloudinaryService";
import { parseBannerDate } from "../services/bannerService";
import {
  createMobileBanner, deleteMobileBanner, getAdminMobileBanners, getMobileBanner,
  getPublicMobileBanners, mobileBannerError, removeUnusedMobileBannerImage,
  reorderMobileBanners, setMobileBannerStatus, updateMobileBanner, validateMobileBannerInput,
  type MobileBannerInput,
} from "../services/mobileBannerService";
import type { MobileBannerRedirectType } from "../models/MobileBanner";

const sendError = (res: Response, error: unknown) => {
  const candidate = error as { statusCode?: number; message?: string };
  const status = candidate.statusCode || (error instanceof mongoose.Error.ValidationError ? 400 : 500);
  res.status(status).json({ success: false, message: status === 500 ? "Mobile banner request failed." : candidate.message || "Mobile banner request failed." });
};

const parseInput = (body: Record<string, unknown>): MobileBannerInput => {
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const redirectType = body.redirectType;
  const redirectTarget = typeof body.redirectTarget === "string" ? body.redirectTarget.trim() : "";
  const displayOrder = Number(body.displayOrder);
  const isActive = body.isActive === true || body.isActive === "true" ? true : body.isActive === false || body.isActive === "false" ? false : null;
  if (!["none", "category", "subcategory", "product"].includes(String(redirectType)) || isActive === null) throw mobileBannerError("Invalid redirect type or active status.");
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  try { startDate = parseBannerDate(body.startDate); endDate = parseBannerDate(body.endDate); }
  catch { throw mobileBannerError("Invalid mobile banner date."); }
  return {
    title, redirectType: redirectType as MobileBannerRedirectType,
    redirectTarget: redirectTarget || undefined, displayOrder, isActive,
    startDate, endDate,
  };
};

export const getPublicMobileBannersController = async (_req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await getPublicMobileBanners() }); }
  catch (error) { console.error("Get public mobile banners error:", error); res.status(500).json({ success: false, message: "Failed to load mobile banners." }); }
};

export const getAdminMobileBannersController = async (_req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await getAdminMobileBanners() }); }
  catch (error) { console.error("Get Admin mobile banners error:", error); res.status(500).json({ success: false, message: "Failed to load mobile banners." }); }
};

export const createMobileBannerController = async (req: Request, res: Response): Promise<void> => {
  let uploadedId: string | undefined;
  try {
    if (!req.file) throw mobileBannerError("Choose a mobile banner image.");
    const input = parseInput(req.body ?? {});
    await validateMobileBannerInput(input);
    const uploaded = await uploadImageToCloudinary(req.file.buffer, "quickcart/mobile-banners");
    uploadedId = uploaded.public_id;
    const banner = await createMobileBanner({ ...input, image: uploaded.secure_url, imagePublicId: uploaded.public_id });
    uploadedId = undefined;
    res.status(201).json({ success: true, message: "Mobile banner created.", data: banner });
  } catch (error) {
    if (uploadedId) await deleteImageFromCloudinary(uploadedId).catch(cleanupError => console.error("Mobile banner upload cleanup error:", cleanupError));
    sendError(res, error);
  }
};

export const updateMobileBannerController = async (req: Request, res: Response): Promise<void> => {
  let uploadedId: string | undefined;
  try {
    const id = String(req.params.id);
    const existing = await getMobileBanner(id);
    const input = parseInput(req.body ?? {});
    await validateMobileBannerInput(input);
    if (req.file) {
      const uploaded = await uploadImageToCloudinary(req.file.buffer, "quickcart/mobile-banners");
      uploadedId = uploaded.public_id;
      input.image = uploaded.secure_url;
      input.imagePublicId = uploaded.public_id;
    }
    const banner = await updateMobileBanner(id, input);
    uploadedId = undefined;
    if (existing.imagePublicId !== banner.imagePublicId) await removeUnusedMobileBannerImage(existing.imagePublicId).catch(error => console.error("Old mobile banner image cleanup error:", error));
    res.json({ success: true, message: "Mobile banner updated.", data: banner });
  } catch (error) {
    if (uploadedId) await deleteImageFromCloudinary(uploadedId).catch(cleanupError => console.error("Mobile banner upload cleanup error:", cleanupError));
    sendError(res, error);
  }
};

export const deleteMobileBannerController = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await deleteMobileBanner(String(req.params.id));
    await removeUnusedMobileBannerImage(banner.imagePublicId).catch(error => console.error("Deleted mobile banner image cleanup error:", error));
    res.json({ success: true, message: "Mobile banner deleted." });
  } catch (error) { sendError(res, error); }
};

export const setMobileBannerStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (typeof req.body?.isActive !== "boolean") throw mobileBannerError("isActive must be true or false.");
    const banner = await setMobileBannerStatus(String(req.params.id), req.body.isActive);
    res.json({ success: true, message: banner.isActive ? "Mobile banner activated." : "Mobile banner deactivated.", data: banner });
  } catch (error) { sendError(res, error); }
};

export const reorderMobileBannersController = async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, message: "Mobile banner order saved.", data: await reorderMobileBanners(req.body?.ids) }); }
  catch (error) { sendError(res, error); }
};
