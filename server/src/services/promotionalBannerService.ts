import PromotionalBanner, { type IPromotionalBanner } from "../models/PromotionalBanner";
import Category from "../models/Category";
import Product from "../models/Product";
import type { PromotionalRedirectType } from "../models/PromotionalBanner";

export interface PromotionalBannerInput {
  redirectType?: PromotionalRedirectType;
  redirectValue?: string;
  image?: string;
  imagePublicId?: string;
  order?: number;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

const validate = (data: PromotionalBannerInput) => {
  if (!data.image) throw new Error("Promotional banner image is required");
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new Error("End date cannot be earlier than start date");
  }
};

const validateRedirect = async (
  data: PromotionalBannerInput,
  required: boolean,
) => {
  if (!data.redirectType && !data.redirectValue) {
    if (required) {
      throw new Error("A promotional banner redirect target is required");
    }
    return;
  }

  if (!data.redirectType || !["category", "product"].includes(data.redirectType)) {
    throw new Error("Promotional banner redirect type must be category or product");
  }

  if (!data.redirectValue || !/^[a-f\d]{24}$/i.test(data.redirectValue)) {
    throw new Error("A valid promotional banner redirect target is required");
  }

  const targetExists =
    data.redirectType === "category"
      ? await Category.exists({ _id: data.redirectValue, isActive: true })
      : await Product.exists({ _id: data.redirectValue, isActive: true });

  if (!targetExists) {
    throw new Error("The selected promotional banner redirect target was not found");
  }
};

const build = (data: PromotionalBannerInput) => ({
  redirectType: data.redirectType,
  redirectValue: data.redirectValue,
  image: data.image,
  imagePublicId: data.imagePublicId,
  order: Number.isFinite(data.order) ? Number(data.order) : 0,
  isActive: data.isActive ?? true,
  startDate: data.startDate,
  endDate: data.endDate,
});

export const getActivePromotionalBanners = async () => {
  const now = new Date();
  return PromotionalBanner.find({
    isActive: true,
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
    ],
  })
    .sort({ order: 1, createdAt: -1 })
    .limit(3);
};

export const getAllPromotionalBanners = () =>
  PromotionalBanner.find().sort({ order: 1, createdAt: -1 });

export const createPromotionalBanner = async (data: PromotionalBannerInput) => {
  validate(data);
  await validateRedirect(data, true);
  return PromotionalBanner.create(build(data));
};

export const updatePromotionalBanner = async (
  id: string,
  data: PromotionalBannerInput,
) => {
  const banner = await PromotionalBanner.findById(id);
  if (!banner) throw new Error("Promotional banner not found");
  validate(data);
  await validateRedirect(data, true);
  Object.assign(banner, build(data));
  await banner.save();
  return banner;
};

export const deletePromotionalBanner = async (id: string) => {
  const banner = await PromotionalBanner.findById(id);
  if (!banner) throw new Error("Promotional banner not found");
  await banner.deleteOne();
  return banner;
};

export const togglePromotionalBanner = async (id: string) => {
  const banner = await PromotionalBanner.findById(id);
  if (!banner) throw new Error("Promotional banner not found");
  banner.isActive = !banner.isActive;
  await banner.save();
  return banner;
};

export type PromotionalBannerDocument = IPromotionalBanner;
