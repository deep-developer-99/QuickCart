import Product from "../models/Product";
import Category from "../models/Category";

interface CreateProductData {
  name: string;
  description: string;
  image: string;
  price: number;
  discountPrice?: number;
  stock: number;
  category: string;
}

interface UpdateProductData {
  name?: string;
  description?: string;
  image?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  category?: string;
}

// Create Product
export const createProduct = async (
  data: CreateProductData,
  vendorId: string,
) => {
  const { name, description, image, price, discountPrice, stock, category } =
    data;

  // Check whether category exists
  const existingCategory = await Category.findById(category);

  if (!existingCategory) {
    throw new Error("Category not found");
  }

  // Create product
  const product = await Product.create({
    name,
    description,
    image,
    price,
    discountPrice,
    stock,
    category,
    vendor: vendorId,
    isActive: true,
  });

  return product;
};

// Get All Active Product
export const getAllProducts = async (search?: string, category?: string) => {
  const filter: Record<string, unknown> = {
    isActive: true,
    stock: { $gt: 0 },
  };

  // Search by product name
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i",
    };
  }

  // Filter by category
  if (category) {
    filter.category = category;
  }

  const products = await Product.find(filter)
    .populate("category", "name image")
    .populate("vendor", "shopName")
    .sort({ createdAt: -1 });

  return products;
};

// Get Product By Id
export const getProductById = async (productId: string) => {
  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  })
    .populate("category", "name image")
    .populate("vendor", "shopName");

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
};

export const getProductsByCategory = async (categoryId: string) => {
  const product = await Product.find({
    category: categoryId,
  }).populate("category");

  return product;
};

// Get Vendor's Product
export const getVendorProducts = async (vendorId: string) => {
  const product = await Product.find({ vendor: vendorId })
    .populate("category", "name image")
    .sort({ createdAt: -1 });

  return product;
};

// Update Product Data
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

// Delete Product
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
  if (!product.isActive === true) {
    throw new Error("Product is already deleted");
  }

  product.isActive = false;

  await product.save();
};

// Restore Product
export const restoreProduct = async (productId: string, vendorId: string) => {
  const product = await Product.findOne({
    _id: productId,
    vendor: vendorId,
  });

  if (!product) {
    throw new Error("Product not found or access denied");
  }

  if (!product.isActive === false) {
    throw new Error("Product is already active");
  }

  product.isActive = true;

  await product.save();

  return product;
};
