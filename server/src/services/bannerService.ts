import Banner from "../models/Banner";
import Category from "../models/Category";
import Product from "../models/Product";
import { createPaginationMeta, getPagination } from "../utils/pagination";
import type { BannerRedirectType } from "../models/Banner";

export interface BannerInput {
  redirectType?: BannerRedirectType;
  redirectValue?: string;
  order?: number;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  image?: string;
  imagePublicId?: string;
  mobileImage?: string;
  mobileImagePublicId?: string;
}

const normalizeOptionalString = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
};

const validateBannerData = (data: BannerInput) => {
  if (!data.image) {
    throw new Error("Banner image is required");
  }

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new Error("End date cannot be earlier than start date");
  }
};

const validateRedirect = async (data: BannerInput, required: boolean) => {
  if (!data.redirectType && !data.redirectValue) {
    if (required) throw new Error("A banner redirect target is required");
    return;
  }

  if (!data.redirectType || !["category", "product"].includes(data.redirectType)) {
    throw new Error("Banner redirect type must be category or product");
  }

  if (!data.redirectValue || !/^[a-f\d]{24}$/i.test(data.redirectValue)) {
    throw new Error("A valid banner redirect target is required");
  }

  const targetExists =
    data.redirectType === "category"
      ? await Category.exists({ _id: data.redirectValue, isActive: true })
      : await Product.exists({ _id: data.redirectValue, isActive: true });

  if (!targetExists) {
    throw new Error("The selected banner redirect target was not found");
  }
};

const buildBannerData = (data: BannerInput) => ({
  redirectType: data.redirectType,
  redirectValue: data.redirectValue,
  order: Number.isFinite(data.order) ? Number(data.order) : 0,
  isActive: data.isActive ?? true,
  startDate: data.startDate,
  endDate: data.endDate,
  image: data.image,
  imagePublicId: data.imagePublicId,
  mobileImage: data.mobileImage,
  mobileImagePublicId: data.mobileImagePublicId,
});

export const getActiveBanners = async () => {
  const now = new Date();

  const banner = await Banner.findOne({
    isActive: true,
    $and: [
      {
        $or: [
          { startDate: { $exists: false } },
          { startDate: null },
          { startDate: { $lte: now } },
        ],
      },
      {
        $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gte: now } },
        ],
      },
    ],
  }).sort({ order: 1, createdAt: -1 });

  return banner ? [banner] : [];
};

export const getAllBannersAdmin = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const [data, totalItems] = await Promise.all([Banner.find().sort({ order: 1, createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), Banner.countDocuments()]);
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getBannerById = async (bannerId: string) => {
  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new Error("Banner not found");
  }

  return banner;
};

export const createBanner = async (data: BannerInput) => {
  validateBannerData(data);
  await validateRedirect(data, true);

  if (data.isActive) {
    await deactivateOtherBanners();
  }

  return Banner.create(buildBannerData(data));
};

export const updateBanner = async (bannerId: string, data: BannerInput) => {
  const currentBanner = await getBannerById(bannerId);

  validateBannerData(data);
  await validateRedirect(data, true);

  if (data.isActive) {
    await deactivateOtherBanners(bannerId);
  }

  currentBanner.redirectType = data.redirectType;
  currentBanner.redirectValue = data.redirectValue;
  currentBanner.order = Number.isFinite(data.order) ? Number(data.order) : 0;
  currentBanner.isActive = data.isActive ?? true;
  currentBanner.startDate = data.startDate;
  currentBanner.endDate = data.endDate;

  if (data.image !== undefined) {
    currentBanner.image = data.image;
    currentBanner.imagePublicId = data.imagePublicId;
  }

  if (data.mobileImage !== undefined) {
    currentBanner.mobileImage = data.mobileImage;
    currentBanner.mobileImagePublicId = data.mobileImagePublicId;
  }

  await currentBanner.save();

  return currentBanner;
};

export const deleteBanner = async (bannerId: string) => {
  const banner = await getBannerById(bannerId);
  await banner.deleteOne();
  return banner;
};

export const toggleBannerStatus = async (bannerId: string) => {
  const banner = await getBannerById(bannerId);

  if (banner.isActive) {
    banner.isActive = false;
    await banner.save();
    return banner;
  }

  await deactivateOtherBanners(bannerId);
  banner.isActive = true;
  await banner.save();
  return banner;
};

const deactivateOtherBanners = async (exceptBannerId?: string) => {
  const filter = exceptBannerId
    ? { isActive: true, _id: { $ne: exceptBannerId } }
    : { isActive: true };

  await Banner.updateMany(filter, { $set: { isActive: false } });
};

export const parseBannerDate = (value: unknown) => {
  const normalized = normalizeOptionalString(value);

  if (!normalized) return undefined;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid banner date");
  }

  return date;
};
