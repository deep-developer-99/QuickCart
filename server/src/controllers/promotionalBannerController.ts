import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createPromotionalBanner,
  deletePromotionalBanner,
  getActivePromotionalBanners,
  getAllPromotionalBanners,
  togglePromotionalBanner,
  updatePromotionalBanner,
  type PromotionalBannerInput,
} from "../services/promotionalBannerService";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinaryService";

const parseDate = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid promotional banner date");
  return date;
};

const parseInput = (body: Record<string, unknown>, image?: { secure_url: string; public_id: string }, fallback?: { image: string; imagePublicId?: string }): PromotionalBannerInput => ({
  image: image?.secure_url || String(body.image || fallback?.image || ""),
  imagePublicId: image?.public_id || String(body.imagePublicId || fallback?.imagePublicId || ""),
  redirectType: body.redirectType as "category" | "product" | undefined,
  redirectValue: String(body.redirectValue || "").trim() || undefined,
  order: Number(body.order || 0),
  isActive: body.isActive === undefined ? true : String(body.isActive) === "true",
  startDate: parseDate(body.startDate),
  endDate: parseDate(body.endDate),
});

const errorResponse = (res: Response, error: unknown) => {
  const message = error instanceof Error ? error.message : "Request failed";
  res.status(message.includes("not found") ? 404 : 400).json({ success: false, message });
};

export const getActivePromotionalBannersController = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getActivePromotionalBanners() });
  } catch (error) {
    console.error("Get promotional banners error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch promotional banners" });
  }
};

export const getAdminPromotionalBannersController = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, data: await getAllPromotionalBanners() });
  } catch (error) {
    console.error("Get admin promotional banners error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch promotional banners" });
  }
};

export const createPromotionalBannerController = async (req: AuthenticatedRequest, res: Response) => {
  let uploadedPublicId: string | undefined;
  try {
    const upload = req.file
      ? await uploadImageToCloudinary(req.file.buffer, "quickcart/promotional-banners")
      : undefined;
    uploadedPublicId = upload?.public_id;
    const banner = await createPromotionalBanner(parseInput(req.body, upload));
    res.status(201).json({ success: true, message: "Promotional banner created", data: banner });
  } catch (error) {
    if (uploadedPublicId) await deleteImageFromCloudinary(uploadedPublicId).catch((cleanupError) => console.error("Promotional banner cleanup error:", cleanupError));
    errorResponse(res, error);
  }
};

export const updatePromotionalBannerController = async (req: AuthenticatedRequest, res: Response) => {
  let uploadedPublicId: string | undefined;
  try {
    const bannerId = String(req.params.id);
    const existing = await getAllPromotionalBanners();
    const current = existing.find((item) => item._id.toString() === bannerId);
    if (!current) throw new Error("Promotional banner not found");
    const upload = req.file
      ? await uploadImageToCloudinary(req.file.buffer, "quickcart/promotional-banners")
      : undefined;
    uploadedPublicId = upload?.public_id;
    const banner = await updatePromotionalBanner(
      bannerId,
      parseInput(req.body, upload || undefined, {
        image: current.image,
        imagePublicId: current.imagePublicId,
      }),
    );
    if (upload && current.imagePublicId) await deleteImageFromCloudinary(current.imagePublicId);
    res.json({ success: true, message: "Promotional banner updated", data: banner });
  } catch (error) {
    if (uploadedPublicId) await deleteImageFromCloudinary(uploadedPublicId).catch((cleanupError) => console.error("Promotional banner cleanup error:", cleanupError));
    errorResponse(res, error);
  }
};

export const deletePromotionalBannerController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const banner = await deletePromotionalBanner(String(req.params.id));
    if (banner.imagePublicId) await deleteImageFromCloudinary(banner.imagePublicId);
    res.json({ success: true, message: "Promotional banner deleted" });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const togglePromotionalBannerController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, data: await togglePromotionalBanner(String(req.params.id)) });
  } catch (error) {
    errorResponse(res, error);
  }
};
