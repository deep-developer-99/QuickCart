import mongoose from "mongoose";
import Category from "../models/Category";
import {
  createSubcategory,
  ensureActiveMainCategory,
  normalizeCategoryName,
  type SubcategoryInput,
} from "./categoryService";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "./cloudinaryService";
import {
  downloadSubcategoryImage,
  SubcategoryImageError,
  validateImageSourceUrl,
} from "./subcategoryImageSource";

export const MAX_BULK_SUBCATEGORIES = 20;
export const SUBCATEGORY_IMAGE_FOLDER = "quickcart/categories/subcategories";

type InputSubcategory = {
  name: string;
  normalizedName: string;
  description?: string;
  image: string;
  isActive: boolean;
  index: number;
};

export type BulkSubcategoryResult = {
  success: boolean;
  message: string;
  summary: { requested: number; created: number; skipped: number; failed: number };
  results: {
    created: Array<{ name: string; id: string; image: string }>;
    skipped: Array<{ name: string; reason: string }>;
    failed: Array<{ name: string; reason: string }>;
    proposed?: Array<{ name: string; normalizedName: string; description?: string; image: string; isActive: boolean }>;
  };
};

export class BulkSubcategoryRequestError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = "BulkSubcategoryRequestError";
  }
}

type ExistingSubcategory = { name: string; normalizedName?: string };
type ExistingCategoryName = { name: string; parentCategory?: mongoose.Types.ObjectId | string | null };

export interface BulkSubcategoryDependencies {
  validateParent(parentId: string): Promise<void>;
  assertHierarchyReady(): Promise<void>;
  listChildren(parentId: string): Promise<ExistingSubcategory[]>;
  listExactGlobalNames(names: string[]): Promise<ExistingCategoryName[]>;
  hasLegacyGlobalNameIndex(): Promise<boolean>;
  validateImageSource(url: string): Promise<void>;
  downloadImage(url: string): Promise<Buffer>;
  uploadImage(buffer: Buffer, folder: string): Promise<{ secure_url: string; public_id: string }>;
  saveSubcategory(data: SubcategoryInput): Promise<{ _id: mongoose.Types.ObjectId | string; name: string; image?: string }>;
  deleteImage(publicId: string): Promise<void>;
}

const dependencies: BulkSubcategoryDependencies = {
  validateParent: async (parentId) => { await ensureActiveMainCategory(parentId); },
  assertHierarchyReady: async () => {
    const indexes = await Category.collection.indexes();
    const hierarchyIndex = indexes.find((index) => index.name === "category_parent_normalized_name_unique");
    if (!hierarchyIndex || hierarchyIndex.unique !== true ||
      JSON.stringify(Object.entries(hierarchyIndex.key).sort()) !== JSON.stringify([["normalizedName", 1], ["parentCategory", 1]])) {
      throw new BulkSubcategoryRequestError(
        "Category hierarchy migration is required before bulk subcategory creation: the scoped unique index is not ready.",
        503,
      );
    }
    const rows = await Category.find({}).select("name parentCategory +normalizedName").lean();
    if (rows.some((row) => !Object.hasOwn(row, "parentCategory") ||
      !row.normalizedName || row.normalizedName !== normalizeCategoryName(row.name))) {
      throw new BulkSubcategoryRequestError(
        "Category hierarchy migration is required before bulk subcategory creation: category hierarchy fields are incomplete.",
        503,
      );
    }
  },
  listChildren: async (parentId) => Category.find({ parentCategory: parentId }).select("name +normalizedName").lean(),
  listExactGlobalNames: async (names) => Category.find({ name: { $in: names } }).select("name parentCategory").lean(),
  hasLegacyGlobalNameIndex: async () => {
    const indexes = await Category.collection.indexes();
    return indexes.some((index) => index.unique === true && Object.keys(index.key || {}).length === 1 && index.key.name === 1);
  },
  validateImageSource: validateImageSourceUrl,
  downloadImage: downloadSubcategoryImage,
  uploadImage: async (buffer, folder) => {
    const uploaded = await uploadImageToCloudinary(buffer, folder);
    if (!uploaded.secure_url || !uploaded.public_id) {
      if (uploaded.public_id) await deleteImageFromCloudinary(uploaded.public_id).catch(() => undefined);
      throw new SubcategoryImageError("Cloudinary did not return a valid image reference.");
    }
    return { secure_url: uploaded.secure_url, public_id: uploaded.public_id };
  },
  saveSubcategory: createSubcategory,
  deleteImage: deleteImageFromCloudinary,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseInput = (body: unknown): { parentCategory: string; inputs: InputSubcategory[] } => {
  if (!isRecord(body) || Object.keys(body).some((key) => !["parentCategory", "subcategories"].includes(key))) {
    throw new BulkSubcategoryRequestError("Body must be a JSON object containing only parentCategory and subcategories.");
  }
  if (typeof body.parentCategory !== "string" || !/^[a-f\d]{24}$/i.test(body.parentCategory.trim()) || !mongoose.isValidObjectId(body.parentCategory.trim())) {
    throw new BulkSubcategoryRequestError("parentCategory must be a valid MongoDB ObjectId.");
  }
  if (!Array.isArray(body.subcategories) || body.subcategories.length < 1) {
    throw new BulkSubcategoryRequestError("subcategories must be a non-empty array.");
  }
  if (body.subcategories.length > MAX_BULK_SUBCATEGORIES) {
    throw new BulkSubcategoryRequestError(`A maximum of ${MAX_BULK_SUBCATEGORIES} subcategories may be submitted per request.`);
  }

  const inputs: InputSubcategory[] = [];
  for (const [index, raw] of body.subcategories.entries()) {
    if (!isRecord(raw) || Object.keys(raw).some((key) => !["name", "description", "image", "isActive"].includes(key))) {
      throw new BulkSubcategoryRequestError(`Subcategory at index ${index} contains invalid fields.`);
    }
    if (typeof raw.name !== "string" || typeof raw.image !== "string") {
      throw new BulkSubcategoryRequestError(`Subcategory at index ${index} requires string name and image fields.`);
    }
    const name = raw.name.trim();
    const image = raw.image.trim();
    if (!name) throw new BulkSubcategoryRequestError(`Subcategory at index ${index} has an empty name.`);
    if (!image) throw new BulkSubcategoryRequestError(`Subcategory at index ${index} has an empty image URL.`);
    if (raw.description !== undefined && typeof raw.description !== "string") {
      throw new BulkSubcategoryRequestError(`Subcategory at index ${index} description must be a string.`);
    }
    if (raw.isActive !== undefined && typeof raw.isActive !== "boolean") {
      throw new BulkSubcategoryRequestError(`Subcategory at index ${index} isActive must be a boolean.`);
    }
    inputs.push({
      name,
      normalizedName: normalizeCategoryName(name),
      description: typeof raw.description === "string" ? raw.description.trim() : undefined,
      image,
      isActive: raw.isActive ?? true,
      index,
    });
  }
  return { parentCategory: body.parentCategory.trim(), inputs };
};

const duplicateKeyDetails = (error: unknown) => error as {
  statusCode?: number;
  categoryConflict?: string;
  message?: string;
};

export const processBulkSubcategories = async (
  body: unknown,
  dryRun = false,
  deps: BulkSubcategoryDependencies = dependencies,
): Promise<BulkSubcategoryResult> => {
  const { parentCategory, inputs } = parseInput(body);
  // Parent validation runs before any image URL lookup, download, or Cloudinary request.
  await deps.validateParent(parentCategory);
  await deps.assertHierarchyReady();

  const existingChildren = await deps.listChildren(parentCategory);
  const existingNormalized = new Set(existingChildren.map((entry) => entry.normalizedName || normalizeCategoryName(entry.name)));
  const legacyGlobalIndex = await deps.hasLegacyGlobalNameIndex();
  const globalNameRows = legacyGlobalIndex
    ? await deps.listExactGlobalNames([...new Set(inputs.map((entry) => entry.name))])
    : [];
  const globalExactNames = new Map(globalNameRows.map((row) => [row.name, row.parentCategory?.toString() ?? null]));

  const results: BulkSubcategoryResult["results"] = { created: [], skipped: [], failed: [] };
  const seenInRequest = new Set<string>();
  const proposed: NonNullable<BulkSubcategoryResult["results"]["proposed"]> = [];

  for (const input of inputs) {
    if (seenInRequest.has(input.normalizedName)) {
      results.skipped.push({ name: input.name, reason: "Duplicate name in this request; the first occurrence is used." });
      continue;
    }
    seenInRequest.add(input.normalizedName);

    if (existingNormalized.has(input.normalizedName)) {
      results.skipped.push({ name: input.name, reason: "Subcategory already exists under this main category (active or inactive)." });
      continue;
    }
    const globalParent = globalExactNames.get(input.name);
    if (legacyGlobalIndex && globalNameRows.some((row) => row.name === input.name) && globalParent !== parentCategory) {
      results.failed.push({
        name: input.name,
        reason: "This exact name conflicts with the legacy global unique name index; complete the category hierarchy migration before reusing it under another parent.",
      });
      continue;
    }

    try {
      await deps.validateImageSource(input.image);
    } catch (error) {
      results.failed.push({ name: input.name, reason: error instanceof SubcategoryImageError ? error.message : "Image URL is invalid, unsafe, or not permitted." });
      continue;
    }

    if (dryRun) {
      proposed.push({
        name: input.name,
        normalizedName: input.normalizedName,
        ...(input.description !== undefined ? { description: input.description } : {}),
        image: input.image,
        isActive: input.isActive,
      });
      continue;
    }

    let uploadedPublicId: string | undefined;
    try {
      const buffer = await deps.downloadImage(input.image);
      const uploaded = await deps.uploadImage(buffer, SUBCATEGORY_IMAGE_FOLDER);
      uploadedPublicId = uploaded.public_id;
      const saved = await deps.saveSubcategory({
        name: input.name,
        description: input.description,
        parentCategory,
        image: uploaded.secure_url,
        imagePublicId: uploaded.public_id,
        isActive: input.isActive,
      });
      uploadedPublicId = undefined;
      results.created.push({ name: input.name, id: saved._id.toString(), image: saved.image || uploaded.secure_url });
      existingNormalized.add(input.normalizedName);
    } catch (error) {
      if (uploadedPublicId) await deps.deleteImage(uploadedPublicId).catch(() => undefined);
      const candidate = duplicateKeyDetails(error);
      if (candidate.categoryConflict === "legacy-global-name-index") {
        results.failed.push({ name: input.name, reason: candidate.message || "The legacy global unique name index rejected this subcategory." });
      } else if (candidate.statusCode === 409) {
        results.skipped.push({ name: input.name, reason: "Subcategory already exists under this main category." });
      } else {
        results.failed.push({ name: input.name, reason: "Image processing or subcategory insertion failed." });
      }
    }
  }

  if (dryRun) results.proposed = proposed;
  const created = results.created.length;
  const skipped = results.skipped.length;
  const failed = results.failed.length;
  const success = dryRun
    ? proposed.length > 0 || (failed === 0 && skipped > 0)
    : created > 0 || (failed === 0 && skipped > 0);
  return {
    success,
    message: dryRun ? "Bulk subcategory validation completed." : "Bulk subcategory processing completed.",
    summary: { requested: inputs.length, created, skipped, failed },
    results,
  };
};
