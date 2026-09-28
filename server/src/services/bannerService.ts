import Banner from "../models/Banner";
import type { BannerRedirectType } from "../models/Banner";

export interface BannerInput {
  title: string;
  subtitle?: string;
  buttonText?: string;
  redirectType: BannerRedirectType;
  redirectValue?: string;
  order?: number;
  backgroundColor?: string;
  textColor?: string;
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
  const title = data.title.trim();
  const colorPattern = /^#[0-9a-fA-F]{6}$/;

  if (!title) {
    throw new Error("Banner title is required");
  }

  if (!data.image) {
    throw new Error("Banner image is required");
  }

  if (!colorPattern.test(data.backgroundColor || "")) {
    throw new Error("Background color must be a valid 6-digit hex color");
  }

  if (!colorPattern.test(data.textColor || "")) {
    throw new Error("Text color must be a valid 6-digit hex color");
  }

  if (!["category", "product", "url"].includes(data.redirectType)) {
    throw new Error("Invalid banner redirect type");
  }

  if (data.redirectType !== "url" && !data.redirectValue) {
    throw new Error("A redirect value is required for this banner");
  }

  if (data.redirectType === "url" && data.redirectValue) {
    try {
      new URL(data.redirectValue);
    } catch {
      throw new Error("Please enter a valid redirect URL");
    }
  }

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new Error("End date cannot be earlier than start date");
  }
};

const buildBannerData = (data: BannerInput) => ({
  title: data.title.trim(),
  subtitle: normalizeOptionalString(data.subtitle),
  buttonText: normalizeOptionalString(data.buttonText),
  redirectType: data.redirectType,
  redirectValue: normalizeOptionalString(data.redirectValue),
  order: Number.isFinite(data.order) ? Number(data.order) : 0,
  backgroundColor: normalizeOptionalString(data.backgroundColor) || "#e9f6e7",
  textColor: normalizeOptionalString(data.textColor) || "#172033",
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

  return Banner.find({
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
};

export const getAllBannersAdmin = async () => {
  return Banner.find().sort({ order: 1, createdAt: -1 });
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
  return Banner.create(buildBannerData(data));
};

export const updateBanner = async (bannerId: string, data: BannerInput) => {
  const currentBanner = await getBannerById(bannerId);

  validateBannerData(data);

  currentBanner.title = data.title.trim();
  currentBanner.subtitle = normalizeOptionalString(data.subtitle);
  currentBanner.buttonText = normalizeOptionalString(data.buttonText);
  currentBanner.redirectType = data.redirectType;
  currentBanner.redirectValue = normalizeOptionalString(data.redirectValue);
  currentBanner.order = Number.isFinite(data.order) ? Number(data.order) : 0;
  currentBanner.backgroundColor =
    normalizeOptionalString(data.backgroundColor) || "#e9f6e7";
  currentBanner.textColor =
    normalizeOptionalString(data.textColor) || "#172033";
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
  banner.isActive = !banner.isActive;
  await banner.save();
  return banner;
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
