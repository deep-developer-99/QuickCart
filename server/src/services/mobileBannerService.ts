import mongoose, { Types } from "mongoose";
import Category from "../models/Category";
import MobileBanner, { type IMobileBanner, type MobileBannerRedirectType } from "../models/MobileBanner";
import Product from "../models/Product";
import { deleteImageFromCloudinary } from "./cloudinaryService";

export const mobileBannerError = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export interface MobileBannerInput {
  title?: string;
  image?: string;
  imagePublicId?: string;
  redirectType: MobileBannerRedirectType;
  redirectTarget?: string;
  displayOrder: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

export const validateMobileBannerInput = async (input: MobileBannerInput): Promise<void> => {
  if (input.title !== undefined && (!input.title.trim() || input.title.length > 120)) throw mobileBannerError("Title must contain 1–120 characters.");
  if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0) throw mobileBannerError("Display order must be a non-negative whole number.");
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw mobileBannerError("End date cannot be earlier than start date.");
  if (input.redirectType === "none") {
    if (input.redirectTarget) throw mobileBannerError("A banner without a destination cannot have a redirect target.");
    return;
  }
  if (!["category", "subcategory", "product"].includes(input.redirectType) || !input.redirectTarget || !mongoose.isValidObjectId(input.redirectTarget)) {
    throw mobileBannerError("Select a valid banner destination.");
  }
  if (input.redirectType === "product") {
    if (!await Product.exists({ _id: input.redirectTarget, isActive: true })) throw mobileBannerError("Selected product is unavailable.");
    return;
  }
  const category = await Category.findOne({ _id: input.redirectTarget, isActive: true })
    .select("_id parentCategory").lean() as { parentCategory?: Types.ObjectId | null } | null;
  if (!category || (input.redirectType === "category" && category.parentCategory) || (input.redirectType === "subcategory" && !category.parentCategory)) {
    throw mobileBannerError("Selected category is unavailable.");
  }
  if (input.redirectType === "subcategory" && !await Category.exists({ _id: category.parentCategory, isActive: true, parentCategory: null })) {
    throw mobileBannerError("Selected parent category is unavailable.");
  }
};

export const getAdminMobileBanners = () => MobileBanner.find().sort({ displayOrder: 1, createdAt: 1, _id: 1 }).lean();

export const getPublicMobileBanners = async () => {
  const now = new Date();
  const rows = await MobileBanner.find({
    isActive: true,
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
    ],
  }).sort({ displayOrder: 1, createdAt: 1, _id: 1 }).lean() as Array<{
    _id: Types.ObjectId; title: string; image: string; redirectType: MobileBannerRedirectType;
    redirectTarget?: string; displayOrder: number;
  }>;
  const categoryIds = rows.filter(row => row.redirectType === "category" || row.redirectType === "subcategory")
    .map(row => row.redirectTarget).filter((id): id is string => Boolean(id && mongoose.isValidObjectId(id)));
  const productIds = rows.filter(row => row.redirectType === "product")
    .map(row => row.redirectTarget).filter((id): id is string => Boolean(id && mongoose.isValidObjectId(id)));
  const [categories, products] = await Promise.all([
    categoryIds.length ? Category.find({ _id: { $in: categoryIds }, isActive: true }).select("_id parentCategory").lean() as Promise<Array<{ _id: Types.ObjectId; parentCategory?: Types.ObjectId | null }>> : [],
    productIds.length ? Product.find({ _id: { $in: productIds }, isActive: true }).select("_id").lean() as Promise<Array<{ _id: Types.ObjectId }>> : [],
  ]);
  const categoryMap = new Map(categories.map(category => [String(category._id), category]));
  const parentIds = [...new Set(categories.map(category => category.parentCategory?.toString()).filter((id): id is string => Boolean(id)))];
  const parents = parentIds.length ? await Category.find({ _id: { $in: parentIds }, isActive: true, parentCategory: null }).select("_id").lean() as Array<{ _id: Types.ObjectId }> : [];
  const activeParents = new Set(parents.map(parent => String(parent._id)));
  const activeProducts = new Set(products.map(product => String(product._id)));
  return rows.flatMap(row => {
    if (!row.image?.startsWith("https://")) return [];
    const target = row.redirectTarget || "";
    const category = categoryMap.get(target);
    if (row.redirectType === "none" && target) return [];
    if (row.redirectType === "category" && (!category || category.parentCategory)) return [];
    if (row.redirectType === "subcategory" && (!category?.parentCategory || !activeParents.has(String(category.parentCategory)))) return [];
    if (row.redirectType === "product" && !activeProducts.has(target)) return [];
    if (!["none", "category", "subcategory", "product"].includes(row.redirectType)) return [];
    return [{ _id: String(row._id), title: row.title, image: row.image, redirectType: row.redirectType,
      ...(row.redirectType === "none" ? {} : { redirectTarget: target }),
      ...(row.redirectType === "subcategory" ? { redirectCategoryId: String(category?.parentCategory) } : {}),
      displayOrder: row.displayOrder }];
  });
};

export const getMobileBanner = async (id: string): Promise<IMobileBanner> => {
  if (!mongoose.isValidObjectId(id)) throw mobileBannerError("Invalid mobile banner ID.");
  const banner = await MobileBanner.findById(id) as IMobileBanner | null;
  if (!banner) throw mobileBannerError("Mobile banner not found.", 404);
  return banner;
};

export const createMobileBanner = async (input: MobileBannerInput) => {
  if (!input.image || !input.imagePublicId) throw mobileBannerError("Mobile banner image is required.");
  await validateMobileBannerInput(input);
  return MobileBanner.create({ ...input, title: input.title?.trim() || `Mobile banner ${new Types.ObjectId().toHexString().slice(-8)}` });
};

export const updateMobileBanner = async (id: string, input: MobileBannerInput) => {
  const banner = await getMobileBanner(id);
  await validateMobileBannerInput(input);
  if (input.title !== undefined) banner.title = input.title.trim();
  banner.redirectType = input.redirectType;
  banner.redirectTarget = input.redirectTarget;
  banner.displayOrder = input.displayOrder;
  banner.isActive = input.isActive;
  banner.startDate = input.startDate;
  banner.endDate = input.endDate;
  if (input.image && input.imagePublicId) { banner.image = input.image; banner.imagePublicId = input.imagePublicId; }
  await banner.save();
  return banner;
};

export const deleteMobileBanner = async (id: string) => {
  const banner = await getMobileBanner(id);
  await banner.deleteOne();
  return banner;
};

export const setMobileBannerStatus = async (id: string, isActive: boolean) => {
  const banner = await getMobileBanner(id);
  banner.isActive = isActive;
  await banner.save();
  return banner;
};

export const reorderMobileBanners = async (ids: unknown) => {
  if (!Array.isArray(ids) || !ids.every(id => typeof id === "string" && mongoose.isValidObjectId(id)) || new Set(ids).size !== ids.length) {
    throw mobileBannerError("Provide each valid mobile banner ID once.");
  }
  const existing = await MobileBanner.find().select("_id").lean() as Array<{ _id: Types.ObjectId }>;
  if (existing.length !== ids.length || existing.some(row => !ids.includes(String(row._id)))) throw mobileBannerError("Order must include every mobile banner. Reload and try again.", 409);
  if (ids.length) await MobileBanner.bulkWrite(ids.map((id, displayOrder) => ({
    updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: { displayOrder } } },
  })));
  return getAdminMobileBanners();
};

export const removeUnusedMobileBannerImage = async (publicId?: string): Promise<void> => {
  if (!publicId?.startsWith("quickcart/mobile-banners/")) return;
  if (await MobileBanner.exists({ imagePublicId: publicId })) return;
  await deleteImageFromCloudinary(publicId);
};
