import type { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Category from "../models/Category";
import MobileCategoryNavigation from "../models/MobileCategoryNavigation";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "../services/cloudinaryService";

type Item = { categoryId: string; displayName?: string; icon?: string; iconPublicId?: string; isActive: boolean };
const key = "homepage";

const categoriesFor = async (ids: string[]) => Category.find({ _id: { $in: ids }, parentCategory: null })
  .select("_id name image isActive").lean() as Promise<Array<{ _id: Types.ObjectId; name: string; image?: string; isActive: boolean }>>;

export const getMobileCategoryNavigation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await MobileCategoryNavigation.findOne({ key }).lean() as { items?: Array<{ category: Types.ObjectId; displayName?: string; icon?: string; isActive: boolean }> } | null;
    const items = config?.items ?? [];
    const valid = items.filter(item => mongoose.isValidObjectId(item.category) && item.isActive);
    const categories = new Map((await categoriesFor(valid.map(item => String(item.category)))).map(category => [String(category._id), category]));
    res.json({ success: true, data: valid.flatMap((item, displayOrder) => {
      const category = categories.get(String(item.category));
      return category?.isActive ? [{ categoryId: String(category._id), name: item.displayName || category.name, image: item.icon || category.image || "", displayOrder }] : [];
    }) });
  } catch (error) {
    console.error("Mobile navigation read error:", error);
    res.status(500).json({ success: false, message: "Failed to load mobile navigation." });
  }
};

export const getAdminMobileCategoryNavigation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [config, available] = await Promise.all([
      MobileCategoryNavigation.findOne({ key }).lean() as Promise<{ revision: number; items: Array<{ category: Types.ObjectId; displayName?: string; icon?: string; iconPublicId?: string; isActive: boolean }> } | null>,
      Category.find({ parentCategory: null, isActive: true }).select("_id name image isActive").sort({ name: 1 }).lean(),
    ]);
    const items = config?.items ?? [];
    const categories = new Map((await categoriesFor(items.map(item => String(item.category)))).map(category => [String(category._id), category]));
    res.json({ success: true, data: {
      revision: config?.revision ?? 0,
      categories: available,
      items: items.map((item, displayOrder) => ({ categoryId: String(item.category), category: categories.get(String(item.category)) ?? null, displayName: item.displayName || "", icon: item.icon || "", iconPublicId: item.iconPublicId || "", isActive: item.isActive, displayOrder })),
    } });
  } catch (error) {
    console.error("Admin mobile navigation read error:", error);
    res.status(500).json({ success: false, message: "Failed to load mobile navigation." });
  }
};

export const saveAdminMobileCategoryNavigation = async (req: Request, res: Response): Promise<void> => {
  try {
    const revision = req.body?.revision;
    const input = req.body?.items;
    if (!Number.isInteger(revision) || revision < 0 || !Array.isArray(input) || input.length > 40) throw new Error("Invalid navigation configuration.");
    const items: Item[] = input.map((value: unknown) => {
      if (!value || typeof value !== "object") throw new Error("Invalid navigation item.");
      const row = value as Record<string, unknown>;
      const categoryId = row.categoryId;
      const displayName = row.displayName ?? "";
      const icon = row.icon ?? "";
      const iconPublicId = row.iconPublicId ?? "";
      if (typeof categoryId !== "string" || !mongoose.isValidObjectId(categoryId) || typeof displayName !== "string" || displayName.trim().length > 40 || typeof icon !== "string" || (icon && (!/^https:\/\//.test(icon) || icon.length > 500)) || typeof iconPublicId !== "string" || (iconPublicId && !iconPublicId.startsWith("quickcart/mobile-navigation/")) || typeof row.isActive !== "boolean") throw new Error("Invalid navigation item.");
      return { categoryId, displayName: displayName.trim(), icon, iconPublicId, isActive: row.isActive };
    });
    const ids = items.map(item => item.categoryId);
    if (new Set(ids).size !== ids.length) throw new Error("A category can only be added once.");
    const found = await categoriesFor(ids);
    if (found.length !== ids.length || found.some(category => !category.isActive)) throw new Error("Select existing active main categories.");
    const current = await MobileCategoryNavigation.findOne({ key }).select("revision items").lean() as { revision: number; items: Array<{ iconPublicId?: string }> } | null;
    if ((current?.revision ?? 0) !== revision) {
      res.status(409).json({ success: false, message: "Navigation changed in another session. Reload before saving." });
      return;
    }
    const next = await MobileCategoryNavigation.findOneAndUpdate(
      { key, revision },
      { $set: { items: items.map(item => ({ category: new Types.ObjectId(item.categoryId), displayName: item.displayName, icon: item.icon, iconPublicId: item.iconPublicId, isActive: item.isActive })) }, $inc: { revision: 1 } },
      { new: true, upsert: !current, runValidators: true },
    );
    if (!next) {
      res.status(409).json({ success: false, message: "Navigation changed in another session. Reload before saving." });
      return;
    }
    const retained = new Set(items.map(item => item.iconPublicId).filter(Boolean));
    await Promise.all((current?.items ?? []).map(item => item.iconPublicId).filter((id): id is string => Boolean(id && !retained.has(id))).map(id => deleteImageFromCloudinary(id).catch(error => console.error("Mobile navigation icon cleanup error:", error))));
    await getAdminMobileCategoryNavigation(req, res);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ success: false, message: "Navigation changed in another session. Reload before saving." });
      return;
    }
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to save mobile navigation." });
  }
};

export const uploadMobileCategoryNavigationIcon = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ success: false, message: "Select an icon image." }); return; }
  try {
    const uploaded = await uploadImageToCloudinary(req.file.buffer, "quickcart/mobile-navigation");
    res.json({ success: true, data: { icon: uploaded.secure_url, iconPublicId: uploaded.public_id } });
  } catch (error) {
    console.error("Mobile navigation icon upload error:", error);
    res.status(500).json({ success: false, message: "Failed to upload icon." });
  }
};

export const deleteUnusedMobileCategoryNavigationIcon = async (req: Request, res: Response): Promise<void> => {
  const publicId = req.body?.publicId;
  if (typeof publicId !== "string" || !publicId.startsWith("quickcart/mobile-navigation/")) {
    res.status(400).json({ success: false, message: "Invalid icon identifier." }); return;
  }
  try {
    const config = await MobileCategoryNavigation.findOne({ key }).select("items.iconPublicId").lean() as { items?: Array<{ iconPublicId?: string }> } | null;
    if (config?.items?.some(item => item.iconPublicId === publicId)) {
      res.status(409).json({ success: false, message: "The icon is in use." }); return;
    }
    await deleteImageFromCloudinary(publicId);
    res.json({ success: true });
  } catch (error) {
    console.error("Mobile navigation unused icon cleanup error:", error);
    res.status(500).json({ success: false, message: "Failed to remove unused icon." });
  }
};
