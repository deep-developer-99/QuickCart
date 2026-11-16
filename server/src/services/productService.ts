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
  variants: Array<{ _id?: string; quantity: number; unit: string; price: number; discountPrice?: number; stock: number; isActive?: boolean }>;
  category: string;
  subCategory?: string | null;
}

interface UpdateProductData {
  name?: string;
  description?: string;
  image?: string;
  imagePublicId?: string;
  variants?: Array<{ _id?: string; quantity: number; unit: string; price: number; discountPrice?: number; stock: number; isActive?: boolean }>;
  category?: string;
  subCategory?: string | null;
}

const validationError = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

const validateVariants = (variants: CreateProductData["variants"] | undefined) => {
  if (variants === undefined) return undefined;
  if (!Array.isArray(variants) || variants.length === 0) throw validationError("Add at least one product variant.");
  const keys = new Set<string>();
  return variants.map((variant) => {
    const quantity = Number(variant.quantity), price = Number(variant.price), stock = Number(variant.stock);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) throw validationError("Each variant needs a valid quantity, price, and whole-number stock.");
    const discountPrice = variant.discountPrice == null || String(variant.discountPrice).trim() === "" ? undefined : Number(variant.discountPrice);
    if (discountPrice !== undefined && (!Number.isFinite(discountPrice) || discountPrice <= 0 || discountPrice >= price)) throw validationError("Variant discount price must be greater than zero and lower than regular price.");
    if (!(PRODUCT_UNITS as readonly string[]).includes(variant.unit)) throw validationError("Select a supported unit type.");
    const key = `${quantity}:${variant.unit}`;
    if (keys.has(key)) throw validationError("Variant quantities and units must be unique.");
    keys.add(key);
    return { ...(variant._id && mongoose.isValidObjectId(variant._id) ? { _id: new mongoose.Types.ObjectId(variant._id) } : {}), quantity, unit: variant.unit, price, ...(discountPrice !== undefined ? { discountPrice } : {}), stock, isActive: variant.isActive !== false };
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

type ProductSort = 'priceLow' | 'priceHigh' | 'az' | 'za';

const getPriceSortedProductIds = async (
  filter: Record<string, unknown>,
  skip: number,
  limit: number,
  direction: 1 | -1,
) => {
  const aggregateFilter = { ...filter };
  if (typeof aggregateFilter.category === 'string') {
    aggregateFilter.category = new mongoose.Types.ObjectId(aggregateFilter.category);
  }
  if (typeof aggregateFilter.subCategory === 'string') {
    aggregateFilter.subCategory = new mongoose.Types.ObjectId(aggregateFilter.subCategory);
  }
  const availableVariants = {
    $filter: {
      input: { $ifNull: ['$variants', []] },
      as: 'variant',
      cond: {
        $and: [
          { $eq: ['$$variant.isActive', true] },
          { $gt: ['$$variant.stock', 0] },
        ],
      },
    },
  };
  const rows = await Product.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $match: aggregateFilter },
    {
      $addFields: {
        _sortSellingPrice: {
          $min: {
            $map: {
              input: availableVariants,
              as: 'variant',
              in: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$$variant.discountPrice', 0] },
                      { $lt: ['$$variant.discountPrice', '$$variant.price'] },
                    ],
                  },
                  '$$variant.discountPrice',
                  '$$variant.price',
                ],
              },
            },
          },
        },
      },
    },
    { $sort: { _sortSellingPrice: direction, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);
  return rows.map(row => row._id);
};

const findProductsPage = async (
  filter: Record<string, unknown>,
  limit: number,
  skip: number,
  sort?: ProductSort,
) => {
  if (sort === 'priceLow' || sort === 'priceHigh') {
    const ids = await getPriceSortedProductIds(filter, skip, limit, sort === 'priceLow' ? 1 : -1);
    if (!ids.length) return [];
    const products = await populateProductCategories(
      Product.find({ _id: { $in: ids } }).select('-price -discountPrice -stock -legacyPricingReview'),
    ).populate('vendor', 'shopName');
    const order = new Map(ids.map((id, index) => [id.toString(), index]));
    return products.sort((a: any, b: any) => order.get(a._id.toString())! - order.get(b._id.toString())!);
  }

  let sortOrder: Record<string, 1 | -1>;
  if (sort === 'az') sortOrder = { name: 1, _id: 1 };
  else if (sort === 'za') sortOrder = { name: -1, _id: 1 };
  else sortOrder = { createdAt: -1, _id: -1 };
  return populateProductCategories(
    Product.find(filter).select('-price -discountPrice -stock -legacyPricingReview')
      .sort(sortOrder).skip(skip).limit(limit),
  ).populate('vendor', 'shopName');
};

export const createProduct = async (data: CreateProductData, vendorId: string) => {
  const categories = await validateProductCategories(data.category, data.subCategory);
  const variants = validateVariants(data.variants);
  if (!variants) throw validationError("Add at least one product variant.");
  if (variants) for (const variant of variants) delete (variant as any)._id;
  return Product.create({ ...data, variants, ...categories, vendor: vendorId, isActive: true });
};

export const getAllProducts = async (
  search?: string,
  category?: string,
  page?: unknown,
  limit?: unknown,
  subCategory?: string,
  sort?: ProductSort,
) => {
  const pagination = getPagination(page, limit);
  const categoryFilter = await validatePublicCategoryFilter(category, subCategory);
  const filter: Record<string, unknown> = { isActive: true, variants: { $elemMatch: { isActive: true, stock: { $gt: 0 } } } };
  if (search) filter.name = { $regex: search, $options: "i" };
  if (categoryFilter.categoryId) filter.category = categoryFilter.categoryId;
  if (categoryFilter.subCategoryId) filter.subCategory = categoryFilter.subCategoryId;

  const [products, totalItems] = await Promise.all([
    findProductsPage(filter, pagination.limit, pagination.skip, sort),
    Product.countDocuments(filter),
  ]);
  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getProductById = async (productId: string) =>
  populateProductCategories(Product.findOne({ _id: productId, isActive: true, variants: { $elemMatch: { isActive: true, stock: { $gt: 0 } } } }).select("-price -discountPrice -stock -legacyPricingReview"))
    .populate("vendor", "shopName");

export const getProductsByCategory = async (
  categoryId: string,
  page?: unknown,
  limit?: unknown,
  subCategoryId?: string,
  sort?: ProductSort,
) => {
  const pagination = getPagination(page, limit);
  const categoryFilter = await validatePublicCategoryFilter(categoryId, subCategoryId);
  const filter: Record<string, unknown> = {
    category: categoryFilter.categoryId,
    isActive: true,
    variants: { $elemMatch: { isActive: true, stock: { $gt: 0 } } },
  };
  if (categoryFilter.subCategoryId) filter.subCategory = categoryFilter.subCategoryId;
  const [products, totalItems] = await Promise.all([
    findProductsPage(filter, pagination.limit, pagination.skip, sort),
    Product.countDocuments(filter),
  ]);
  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getVendorProducts = async (vendorId: string, page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter = { vendor: vendorId };
  const [products, totalItems] = await Promise.all([
    populateProductCategories(Product.find(filter).select("-price -discountPrice -stock -legacyPricingReview")).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Product.countDocuments(filter),
  ]);
  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getVendorProductById = async (productId: string, vendorId: string) => {
  const product = await populateProductCategories(Product.findOne({ _id: productId, vendor: vendorId }).select("-price -discountPrice -stock -legacyPricingReview"));
  if (!product) throw new Error("Product not found or access denied");
  return product;
};

export const updateProduct = async (productId: string, vendorId: string, data: UpdateProductData) => {
  const productQuery = Product.findOne({ _id: productId, vendor: vendorId });
  if (typeof (productQuery as any).select === "function") productQuery.select("-price -discountPrice -stock");
  const product = await productQuery;
  if (!product) throw new Error("Product not found or access denied");

  const finalCategory = data.category ?? product.category.toString();
  const hasSubcategoryUpdate = Object.prototype.hasOwnProperty.call(data, "subCategory");
  const finalSubcategory = hasSubcategoryUpdate
    ? data.subCategory ?? null
    : product.subCategory?.toString() ?? null;
  const categories = await validateProductCategories(finalCategory, finalSubcategory);

  const variants = validateVariants(data.variants);
  if (Object.prototype.hasOwnProperty.call(data, "variants") && !variants?.length) throw validationError("Keep at least one valid product variant.");
  if (variants) {
    const ownedVariantIds = new Set((product.variants ?? []).map((item: any) => item._id.toString()));
    for (const variant of variants) {
      if (variant._id && !ownedVariantIds.has(variant._id.toString())) throw validationError("Variant does not belong to this product.");
    }
  }
  Object.assign(product, data, categories);
  if (variants) {
    product.variants = variants as any;
    if (product.legacyPricingReview?.status === "needs_review") {
      product.legacyPricingReview.status = "reviewed";
      product.legacyPricingReview.reviewedAt = new Date();
      product.legacyPricingReview.reason = "Vendor supplied explicit variant quantities and units.";
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
