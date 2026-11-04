import mongoose from "mongoose";

import Product from "../models/Product";
import Category from "../models/Category";
import { createPaginationMeta, getPagination } from "../utils/pagination";

interface CreateProductData {
  name: string;
  description: string;
  image: string;
  imagePublicId?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  category: string;
  subCategory?: string | null;
}

interface UpdateProductData {
  name?: string;
  description?: string;
  image?: string;
  imagePublicId?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  category?: string;
  subCategory?: string | null;
}

const validationError = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

const validateProductCategories = async (categoryId: string, subCategoryId?: string | null) => {
  if (!mongoose.isValidObjectId(categoryId)) throw validationError("Select a valid main category.");
  const category = await Category.findById(categoryId);
  if (!category || !category.isActive || category.parentCategory != null) {
    throw validationError("Select an active main category.");
  }

  if (!subCategoryId) return { category: category._id, subCategory: null };
  if (!mongoose.isValidObjectId(subCategoryId)) throw validationError("Select a valid subcategory.");
  const subCategory = await Category.findById(subCategoryId);
  if (!subCategory || !subCategory.isActive || subCategory.parentCategory == null) {
    throw validationError("Select an active subcategory.");
  }
  if (subCategory.parentCategory.toString() !== category._id.toString()) {
    throw validationError("The selected subcategory does not belong to the selected main category.");
  }
  return { category: category._id, subCategory: subCategory._id };
};

const populateProductCategories = <T>(query: T): T => {
  const populatedQuery = query as T & { populate: (path: string, select: string) => unknown };
  populatedQuery.populate("category", "name image isActive");
  populatedQuery.populate("subCategory", "name image isActive parentCategory");
  return query;
};

const validatePublicCategoryFilter = async (category?: string, subCategory?: string) => {
  let categoryId = category;
  if (subCategory) {
    if (!mongoose.isValidObjectId(subCategory)) throw validationError("Invalid subcategory filter.");
    const child = await Category.findById(subCategory);
    if (!child || !child.isActive || child.parentCategory == null) throw validationError("Subcategory not found.");
    if (categoryId && child.parentCategory.toString() !== categoryId) {
      throw validationError("The subcategory does not belong to the selected main category.");
    }
    categoryId = child.parentCategory.toString();
  }
  if (categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) throw validationError("Invalid main category filter.");
    const main = await Category.findById(categoryId);
    if (!main || !main.isActive || main.parentCategory != null) throw validationError("Main category not found.");
  }
  return { categoryId, subCategoryId: subCategory };
};

export const createProduct = async (data: CreateProductData, vendorId: string) => {
  const categories = await validateProductCategories(data.category, data.subCategory);
  return Product.create({ ...data, ...categories, vendor: vendorId, isActive: true });
};

export const getAllProducts = async (
  search?: string,
  category?: string,
  page?: unknown,
  limit?: unknown,
  subCategory?: string,
) => {
  const pagination = getPagination(page, limit);
  const categoryFilter = await validatePublicCategoryFilter(category, subCategory);
  const filter: Record<string, unknown> = { isActive: true, stock: { $gt: 0 } };
  if (search) filter.name = { $regex: search, $options: "i" };
  if (categoryFilter.categoryId) filter.category = categoryFilter.categoryId;
  if (categoryFilter.subCategoryId) filter.subCategory = categoryFilter.subCategoryId;

  const [products, totalItems] = await Promise.all([
    populateProductCategories(Product.find(filter)).populate("vendor", "shopName")
      .sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Product.countDocuments(filter),
  ]);
  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getProductById = async (productId: string) =>
  populateProductCategories(Product.findOne({ _id: productId, isActive: true }))
    .populate("vendor", "shopName");

export const getProductsByCategory = async (
  categoryId: string,
  page?: unknown,
  limit?: unknown,
  subCategoryId?: string,
) => {
  const pagination = getPagination(page, limit);
  const categoryFilter = await validatePublicCategoryFilter(categoryId, subCategoryId);
  const filter: Record<string, unknown> = {
    category: categoryFilter.categoryId,
    isActive: true,
    stock: { $gt: 0 },
  };
  if (categoryFilter.subCategoryId) filter.subCategory = categoryFilter.subCategoryId;
  const [products, totalItems] = await Promise.all([
    populateProductCategories(Product.find(filter)).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Product.countDocuments(filter),
  ]);
  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getVendorProducts = async (vendorId: string, page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter = { vendor: vendorId };
  const [products, totalItems] = await Promise.all([
    populateProductCategories(Product.find(filter)).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Product.countDocuments(filter),
  ]);
  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getVendorProductById = async (productId: string, vendorId: string) => {
  const product = await populateProductCategories(Product.findOne({ _id: productId, vendor: vendorId }));
  if (!product) throw new Error("Product not found or access denied");
  return product;
};

export const updateProduct = async (productId: string, vendorId: string, data: UpdateProductData) => {
  const product = await Product.findOne({ _id: productId, vendor: vendorId });
  if (!product) throw new Error("Product not found or access denied");

  const finalCategory = data.category ?? product.category.toString();
  const hasSubcategoryUpdate = Object.prototype.hasOwnProperty.call(data, "subCategory");
  const finalSubcategory = hasSubcategoryUpdate
    ? data.subCategory ?? null
    : product.subCategory?.toString() ?? null;
  const categories = await validateProductCategories(finalCategory, finalSubcategory);

  Object.assign(product, data, categories);
  await product.save();
  return product;
};

export const deleteProduct = async (productId: string, vendorId: string): Promise<void> => {
  const product = await Product.findOne({ _id: productId, vendor: vendorId });
  if (!product) throw new Error("Product not found or access denied");
  if (product.isActive === false) throw new Error("Product is already deleted");
  product.isActive = false;
  await product.save();
};

export const restoreProduct = async (productId: string, vendorId: string) => {
  const product = await Product.findOne({ _id: productId, vendor: vendorId });
  if (!product) throw new Error("Product not found or access denied");
  if (product.isActive === true) throw new Error("Product is already active");
  product.isActive = true;
  await product.save();
  return product;
};
