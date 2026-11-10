import mongoose from "mongoose";

import Product from "../models/Product";
import Category from "../models/Category";
import { createPaginationMeta, getPagination } from "../utils/pagination";

interface CreateCategoryData {
  name: string;
  description?: string;
  image?: string;
  imagePublicId?: string;
}

interface UpdateCategoryData extends CreateCategoryData {}

export interface SubcategoryInput {
  name: string;
  description?: string;
  parentCategory: string;
  image?: string;
  imagePublicId?: string;
  isActive?: boolean;
}

const normalizeName = (name: string) => name.trim().normalize("NFKC").toLocaleLowerCase("en");
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const duplicateError = (message: string) => Object.assign(new Error(message), { statusCode: 409 });
const validationError = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

const ensureActiveMainCategory = async (categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) throw validationError("Select a valid main category.");
  const parent = await Category.findOne({ _id: categoryId, parentCategory: null, isActive: true });
  if (!parent) throw validationError("The selected main category is missing, inactive, or is a subcategory.");
  return parent;
};

// Public category list remains main categories only for existing homepage consumers.
export const getAllCategories = async () =>
  Category.find({ isActive: true, parentCategory: null }).sort({ name: 1 });

// Existing category detail URLs continue to resolve active main categories.
export const getCategoryById = async (categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) throw validationError("Category not found");
  const category = await Category.findOne({ _id: categoryId, isActive: true, parentCategory: null });
  if (!category) throw new Error("Category not found");
  return category;
};

export const getSubcategoriesByParent = async (parentCategoryId: string) => {
  await ensureActiveMainCategory(parentCategoryId);
  return Category.find({ parentCategory: parentCategoryId, isActive: true }).sort({ name: 1 });
};

// Admin category management contains main categories only.
export const getAllCategoriesAdmin = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter = { parentCategory: null };
  const [data, totalItems] = await Promise.all([
    Category.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Category.countDocuments(filter),
  ]);
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getAdminSubcategories = async (options: {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  parentCategory?: unknown;
  isActive?: unknown;
}) => {
  const pagination = getPagination(options.page, options.limit);
  const filter: Record<string, unknown> = { parentCategory: { $ne: null } };
  if (typeof options.search === "string" && options.search.trim()) {
    filter.name = { $regex: escapeRegex(options.search.trim()), $options: "i" };
  }
  if (typeof options.parentCategory === "string" && options.parentCategory.trim()) {
    if (!mongoose.isValidObjectId(options.parentCategory)) throw validationError("Invalid main category filter.");
    filter.parentCategory = options.parentCategory;
  }
  if (options.isActive === "true" || options.isActive === "false") {
    filter.isActive = options.isActive === "true";
  }
  const [data, totalItems] = await Promise.all([
    Category.find(filter).populate("parentCategory", "name").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Category.countDocuments(filter),
  ]);
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems), totalSubcategories: totalItems };
};

export const createCategory = async (data: CreateCategoryData) => {
  const name = data.name.trim();
  if (!name) throw validationError("Category name is required");
  const normalizedName = normalizeName(name);
  const existingCategory = await Category.findOne({ parentCategory: null, normalizedName });
  if (existingCategory) {
    if (existingCategory.isActive === false) {
      existingCategory.isActive = true;
      if (data.image !== undefined) existingCategory.image = data.image;
      if (data.imagePublicId !== undefined) existingCategory.imagePublicId = data.imagePublicId;
      if (data.description !== undefined) existingCategory.description = data.description.trim();
      await existingCategory.save();
      return existingCategory;
    }
    throw duplicateError("A main category with this name already exists.");
  }
  try {
    return await Category.create({
      name,
      description: data.description?.trim(),
      normalizedName,
      parentCategory: null,
      image: data.image,
      imagePublicId: data.imagePublicId,
      isActive: true,
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw duplicateError("A main category with this name already exists.");
    throw error;
  }
};

export const getCategoryByIdAdmin = async (categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) throw validationError("Category not found");
  const category = await Category.findOne({ _id: categoryId, parentCategory: null });
  if (!category) throw new Error("Category not found");
  return category;
};

export const updateCategory = async (categoryId: string, data: UpdateCategoryData) => {
  const name = data.name.trim();
  if (!name) throw validationError("Category name is required");
  const category = await getCategoryByIdAdmin(categoryId);
  const normalizedName = normalizeName(name);
  const existingCategory = await Category.findOne({
    _id: { $ne: categoryId }, parentCategory: null, normalizedName,
  });
  if (existingCategory) throw duplicateError("Another main category with this name already exists.");
  category.name = name;
  category.normalizedName = normalizedName;
  if (data.image !== undefined) category.image = data.image;
  if (data.imagePublicId !== undefined) category.imagePublicId = data.imagePublicId;
  if (data.description !== undefined) category.description = data.description.trim();
  try {
    await category.save();
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw duplicateError("Another main category with this name already exists.");
    throw error;
  }
  return category;
};

export const createSubcategory = async (data: SubcategoryInput) => {
  const name = data.name.trim();
  if (!name) throw validationError("Subcategory name is required.");
  if (!data.image?.trim() || !data.imagePublicId?.trim()) throw validationError("A successfully uploaded subcategory image is required.");
  await ensureActiveMainCategory(data.parentCategory);
  const normalizedName = normalizeName(name);
  const existing = await Category.findOne({ parentCategory: data.parentCategory, normalizedName });
  if (existing) throw duplicateError("A subcategory with this name already exists under that main category.");
  try {
    return await Category.create({
      name,
      description: data.description,
      normalizedName,
      parentCategory: data.parentCategory,
      image: data.image,
      imagePublicId: data.imagePublicId,
      isActive: data.isActive ?? true,
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw duplicateError("A subcategory with this name already exists under that main category.");
    throw error;
  }
};

export const getSubcategoryByIdAdmin = async (subcategoryId: string) => {
  if (!mongoose.isValidObjectId(subcategoryId)) throw validationError("Subcategory not found.");
  const subcategory = await Category.findOne({ _id: subcategoryId, parentCategory: { $ne: null } });
  if (!subcategory) throw new Error("Subcategory not found.");
  return subcategory;
};

export const updateSubcategory = async (subcategoryId: string, data: SubcategoryInput) => {
  const subcategory = await getSubcategoryByIdAdmin(subcategoryId);
  const name = data.name.trim();
  if (!name) throw validationError("Subcategory name is required.");
  await ensureActiveMainCategory(data.parentCategory);
  const finalImage = data.image ?? subcategory.image;
  const finalImagePublicId = data.imagePublicId ?? subcategory.imagePublicId;
  if (!finalImage?.trim() || !finalImagePublicId?.trim()) throw validationError("A valid subcategory image is required.");

  const currentParent = subcategory.parentCategory?.toString();
  if (currentParent !== data.parentCategory) {
    const assignedProducts = await Product.countDocuments({ subCategory: subcategory._id });
    if (assignedProducts > 0) {
      throw Object.assign(
        new Error(`Reassign the ${assignedProducts} product${assignedProducts === 1 ? "" : "s"} before moving this subcategory to another main category.`),
        { statusCode: 409, productsCount: assignedProducts },
      );
    }
  }

  const normalizedName = normalizeName(name);
  const duplicate = await Category.findOne({
    _id: { $ne: subcategory._id }, parentCategory: data.parentCategory, normalizedName,
  });
  if (duplicate) throw duplicateError("A subcategory with this name already exists under that main category.");

  subcategory.name = name;
  if (data.description !== undefined) subcategory.description = data.description;
  subcategory.normalizedName = normalizedName;
  subcategory.parentCategory = new mongoose.Types.ObjectId(data.parentCategory);
  if (data.image !== undefined) subcategory.image = data.image;
  if (data.imagePublicId !== undefined) subcategory.imagePublicId = data.imagePublicId;
  if (data.isActive !== undefined) subcategory.isActive = data.isActive;
  try {
    await subcategory.save();
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw duplicateError("A subcategory with this name already exists under that main category.");
    throw error;
  }
  return subcategory;
};

export const deleteSubcategory = async (subcategoryId: string) => {
  const subcategory = await getSubcategoryByIdAdmin(subcategoryId);
  if (!subcategory.isActive) throw validationError("Subcategory is already inactive.");
  const productsCount = await Product.countDocuments({ subCategory: subcategoryId });
  if (productsCount > 0) {
    throw Object.assign(
      new Error(`Cannot delete this subcategory while ${productsCount} product${productsCount === 1 ? " is" : "s are"} assigned. Reassign those products first.`),
      { statusCode: 409, productsCount },
    );
  }
  subcategory.isActive = false;
  await subcategory.save();
  return { subcategory, productsCount };
};

// Soft-delete a main category. It cannot be removed while active products or any children remain.
export const deleteCategory = async (categoryId: string) => {
  const category = await getCategoryByIdAdmin(categoryId);
  if (!category.isActive) throw validationError("Category is already deleted");
  const [productsCount, childCount] = await Promise.all([
    Product.countDocuments({ category: categoryId, isActive: true }),
    Category.countDocuments({ parentCategory: categoryId }),
  ]);
  if (childCount > 0) {
    throw Object.assign(new Error(`Reassign or deactivate/delete all ${childCount} subcategor${childCount === 1 ? "y" : "ies"} before deleting this main category.`), { statusCode: 409, subcategoriesCount: childCount });
  }
  if (productsCount > 0) {
    throw Object.assign(new Error(`Cannot delete this category because ${productsCount} active product${productsCount === 1 ? " is" : "s are"} using it.`), { statusCode: 409, productsCount });
  }
  category.isActive = false;
  await category.save();
  return category;
};
