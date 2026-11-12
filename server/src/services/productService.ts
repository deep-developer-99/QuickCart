import mongoose from "mongoose";

import Product from "../models/Product";
import { PRODUCT_UNITS } from "../models/Product";
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
  variants?: Array<{ _id?: string; quantity: number; unit: string; price: number; stock: number; isActive?: boolean }>;
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
  variants?: Array<{ _id?: string; quantity: number; unit: string; price: number; stock: number; isActive?: boolean }>;
  category?: string;
  subCategory?: string | null;
}

const validationError = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

const validateVariants = (variants: CreateProductData["variants"]) => {
  if (variants === undefined) return undefined;
  if (!Array.isArray(variants) || variants.length === 0) throw validationError("Add at least one product variant.");
  const keys = new Set<string>();
  return variants.map((variant) => {
    const quantity = Number(variant.quantity), price = Number(variant.price), stock = Number(variant.stock);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) throw validationError("Each variant needs a valid quantity, price, and whole-number stock.");
    if (!(PRODUCT_UNITS as readonly string[]).includes(variant.unit)) throw validationError("Select a supported unit type.");
    const key = `${quantity}:${variant.unit}`;
    if (keys.has(key)) throw validationError("Variant quantities and units must be unique.");
    keys.add(key);
    return { ...(variant._id && mongoose.isValidObjectId(variant._id) ? { _id: new mongoose.Types.ObjectId(variant._id) } : {}), quantity, unit: variant.unit, price, stock, isActive: variant.isActive !== false };
  });
};

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
  const variants = validateVariants(data.variants);
  if (!variants) throw validationError("Add at least one product variant.");
  if (variants) for (const variant of variants) delete (variant as any)._id;
  const legacyPrice = variants?.[0]?.price ?? data.price;
  const legacyStock = variants?.filter((item) => item.isActive).reduce((sum, item) => sum + item.stock, 0) ?? data.stock;
  return Product.create({ ...data, price: legacyPrice, stock: legacyStock, ...(variants ? { variants } : {}), ...categories, vendor: vendorId, isActive: true });
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

  const variants = validateVariants(data.variants);
  if (variants) {
    const ownedVariantIds = new Set((product.variants ?? []).map((item: any) => item._id.toString()));
    for (const variant of variants) {
      if (variant._id && !ownedVariantIds.has(variant._id.toString())) throw validationError("Variant does not belong to this product.");
    }
  }
  const isConvertingLegacyProduct = Boolean(variants?.length && !product.variants?.length);
  const originalLegacyPrice = product.price;
  const originalLegacyStock = product.stock;
  Object.assign(product, data, categories);
  if (variants) {
    product.variants = variants as any;
    product.price = variants[0].price;
    product.stock = variants.filter((item) => item.isActive).reduce((sum, item) => sum + item.stock, 0);
    if (isConvertingLegacyProduct) {
      product.legacyPrice = originalLegacyPrice;
      product.legacyStock = originalLegacyStock;
    }
  }
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
