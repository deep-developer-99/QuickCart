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
}

export const createProduct = async (
  data: CreateProductData,
  vendorId: string,
) => {
  const {
    name,
    description,
    image,
    imagePublicId,
    price,
    discountPrice,
    stock,
    category,
  } = data;

  const existingCategory = await Category.findById(category);

  if (!existingCategory) {
    throw new Error("Category not found");
  }

  const product = await Product.create({
    name,
    description,
    image,
    imagePublicId,
    price,
    discountPrice,
    stock,
    category,
    vendor: vendorId,
    isActive: true,
  });

  return product;
};

export const getAllProducts = async (search?: string, category?: string, page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter: Record<string, unknown> = {
    isActive: true,
    stock: { $gt: 0 },
  };

  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }

  if (category) {
    filter.category = category;
  }

  const [products, totalItems] = await Promise.all([Product.find(filter)
    .populate("category", "name image")
    .populate("vendor", "shopName")
    .sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), Product.countDocuments(filter)]);

  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getProductById = async (productId: string) => {
  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  })
    .populate("category", "name image")
    .populate("vendor", "shopName");

  return product;
};

export const getProductsByCategory = async (categoryId: string, page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter = {
    category: categoryId,
    isActive: true,
    stock: { $gt: 0 },
  };
  const [products, totalItems] = await Promise.all([Product.find(filter).populate("category", "name image").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), Product.countDocuments(filter)]);

  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getVendorProducts = async (vendorId: string, page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter = { vendor: vendorId };
  const [products, totalItems] = await Promise.all([Product.find(filter)
    .populate("category", "name image")
    .sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), Product.countDocuments(filter)]);

  return { data: products, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const getVendorProductById = async (
  productId: string,
  vendorId: string,
) => {
  const product = await Product.findOne({
    _id: productId,
    vendor: vendorId,
  }).populate("category", "name image");

  if (!product) {
    throw new Error("Product not found or access denied");
  }

  return product;
};

export const updateProduct = async (
  productId: string,
  vendorId: string,
  data: UpdateProductData,
) => {
  const product = await Product.findOne({
    _id: productId,
    vendor: vendorId,
  });

  if (!product) {
    throw new Error("Product not found or access denied");
  }

  if (data.category) {
    const category = await Category.findById(data.category);

    if (!category) {
      throw new Error("Category not found");
    }
  }

  Object.assign(product, data);

  await product.save();

  return product;
};

export const deleteProduct = async (
  productId: string,
  vendorId: string,
): Promise<void> => {
  const product = await Product.findOne({
    _id: productId,
    vendor: vendorId,
  });

  if (!product) {
    throw new Error("Product not found or access denied");
  }

  if (product.isActive === false) {
    throw new Error("Product is already deleted");
  }

  product.isActive = false;

  await product.save();
};

export const restoreProduct = async (productId: string, vendorId: string) => {
  const product = await Product.findOne({
    _id: productId,
    vendor: vendorId,
  });

  if (!product) {
    throw new Error("Product not found or access denied");
  }

  if (product.isActive === true) {
    throw new Error("Product is already active");
  }

  product.isActive = true;

  await product.save();

  return product;
};
