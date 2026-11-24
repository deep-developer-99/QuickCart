import { Request, Response } from "express";

import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createBanner,
  deleteBanner,
  getActiveBanners,
  getAllBannersAdmin,
  getBannerById,
  parseBannerDate,
  toggleBannerStatus,
  updateBanner,
} from "../services/bannerService";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinaryService";

const parseBoolean = (value: unknown, defaultValue = true) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") return value;

  return String(value).toLowerCase() === "true";
};

const parseOrder = (value: unknown) => {
  if (value === undefined || value === null || value === "") return 0;

  const order = Number(value);

  if (!Number.isFinite(order) || order < 0) {
    throw new Error("Display order must be a non-negative number");
  }

  return order;
};

const bannerFiles = (req: AuthenticatedRequest) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  return { image: files?.image?.[0], mobileImage: files?.mobileImage?.[0] };
};

export const getActiveBannersController = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const banners = await getActiveBanners();

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error("Get active banners error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

export const getAllBannersAdminController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const banners = await getAllBannersAdmin(req.query.page, req.query.limit);

    res.status(200).json({
      success: true,
      ...banners,
    });
  } catch (error) {
    console.error("Get admin banners error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

export const createBannerController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let uploadedImagePublicId: string | undefined;
  let uploadedMobilePublicId: string | undefined;

  try {
    const files = bannerFiles(req);
    if (!files.image) {
      res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
      return;
    }

    const order = parseOrder(req.body.order);
    const redirectType = req.body.redirectType as "category" | "product" | undefined;
    const redirectValue = String(req.body.redirectValue || "").trim() || undefined;
    const isActive = parseBoolean(req.body.isActive, true);
    const startDate = parseBannerDate(req.body.startDate);
    const endDate = parseBannerDate(req.body.endDate);

    const uploadedImage = await uploadImageToCloudinary(
      files.image.buffer,
      "quickcart/banners",
    );

    uploadedImagePublicId = uploadedImage.public_id;
    const uploadedMobile = files.mobileImage ? await uploadImageToCloudinary(files.mobileImage.buffer, "quickcart/banners/mobile") : undefined;
    uploadedMobilePublicId = uploadedMobile?.public_id;

    try {
      const banner = await createBanner({
        order,
        redirectType,
        redirectValue,
        isActive,
        startDate,
        endDate,
        image: uploadedImage.secure_url,
        imagePublicId: uploadedImage.public_id,
        mobileImage: uploadedMobile?.secure_url,
        mobileImagePublicId: uploadedMobile?.public_id,
      });

      uploadedImagePublicId = undefined;
      uploadedMobilePublicId = undefined;

      res.status(201).json({
        success: true,
        message: "Banner created successfully",
        data: banner,
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    if (uploadedImagePublicId) await deleteImageFromCloudinary(uploadedImagePublicId).catch(() => undefined);
    if (uploadedMobilePublicId) await deleteImageFromCloudinary(uploadedMobilePublicId).catch(() => undefined);
    console.error("Create banner error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create banner",
    });
  }
};

export const updateBannerController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let uploadedImagePublicId: string | undefined;
  let uploadedMobilePublicId: string | undefined;

  try {
    const { id } = req.params as { id: string };
    const currentBanner = await getBannerById(id);
    const files = bannerFiles(req);

    const order = parseOrder(req.body.order);
    const redirectType = req.body.redirectType as "category" | "product" | undefined;
    const redirectValue = String(req.body.redirectValue || "").trim() || undefined;
    const isActive = parseBoolean(req.body.isActive, true);
    const startDate = parseBannerDate(req.body.startDate);
    const endDate = parseBannerDate(req.body.endDate);

    let image = currentBanner.image;
    let imagePublicId = currentBanner.imagePublicId;

    if (files.image) {
      const uploadedImage = await uploadImageToCloudinary(
        files.image.buffer,
        "quickcart/banners",
      );

      uploadedImagePublicId = uploadedImage.public_id;
      image = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }
    const uploadedMobile = files.mobileImage ? await uploadImageToCloudinary(files.mobileImage.buffer, "quickcart/banners/mobile") : undefined;
    uploadedMobilePublicId = uploadedMobile?.public_id;

    try {
      const banner = await updateBanner(id, {
        order,
        redirectType,
        redirectValue,
        isActive,
        startDate,
        endDate,
        image,
        imagePublicId,
        mobileImage: uploadedMobile?.secure_url ?? currentBanner.mobileImage,
        mobileImagePublicId: uploadedMobile?.public_id ?? currentBanner.mobileImagePublicId,
      });

      if (
        files.image &&
        currentBanner.imagePublicId &&
        currentBanner.imagePublicId !== banner.imagePublicId
      ) {
        await deleteImageFromCloudinary(currentBanner.imagePublicId).catch(
          (error) => {
            console.error(
              "Failed to delete previous banner image from Cloudinary:",
              error,
            );
          },
        );
      }
      if (uploadedMobile && currentBanner.mobileImagePublicId && currentBanner.mobileImagePublicId !== uploadedMobile.public_id) await deleteImageFromCloudinary(currentBanner.mobileImagePublicId).catch(() => undefined);

      uploadedImagePublicId = undefined;
      uploadedMobilePublicId = undefined;

      res.status(200).json({
        success: true,
        message: "Banner updated successfully",
        data: banner,
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    if (uploadedImagePublicId) await deleteImageFromCloudinary(uploadedImagePublicId).catch(() => undefined);
    if (uploadedMobilePublicId) await deleteImageFromCloudinary(uploadedMobilePublicId).catch(() => undefined);
    console.error("Update banner error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update banner",
    });
  }
};

export const deleteBannerController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const banner = await deleteBanner(id);

    if (banner.imagePublicId) {
      await deleteImageFromCloudinary(banner.imagePublicId).catch((error) => {
        console.error("Failed to delete banner image from Cloudinary:", error);
      });
    }

    if (banner.mobileImagePublicId) {
      await deleteImageFromCloudinary(banner.mobileImagePublicId).catch(
        (error) => {
          console.error(
            "Failed to delete mobile banner image from Cloudinary:",
            error,
          );
        },
      );
    }

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Delete banner error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete banner",
    });
  }
};

export const toggleBannerStatusController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const banner = await toggleBannerStatus(id);

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      data: banner,
    });
  } catch (error) {
    console.error("Toggle banner status error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update banner status",
    });
  }
};
