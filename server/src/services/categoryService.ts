import Product from "../models/Product";
import Category from "../models/Category";

interface CreateCategoryData {
  name: string;
  image?: string;
  imagePublicId?: string;
}

interface UpdateCategoryData {
  name: string;
  image?: string;
  imagePublicId?: string;
}

// Get all active categories for users/vendors.
export const getAllCategories = async () => {
  const categories = await Category.find({
    isActive: true,
  }).sort({ name: 1 });

  return categories;
};

// Get category by ID.
export const getCategoryById = async (categoryId: string) => {
  const category = await Category.findOne({
    _id: categoryId,
    isActive: true,
  });

  if (!category) {
    throw new Error("Category not found");
  }

  return category;
};

// Get all active/inactive categories for admin.
export const getAllCategoriesAdmin = async () => {
  return Category.find().sort({ createdAt: -1 });
};

// Create a new category.
export const createCategory = async (data: CreateCategoryData) => {
  const name = data.name.trim();

  if (!name) {
    throw new Error("Category name is required");
  }

  const existingCategory = await Category.findOne({
    name: {
      $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  });

  if (existingCategory) {
    if (existingCategory.isActive === false) {
      existingCategory.isActive = true;
      existingCategory.image = data.image;
      existingCategory.imagePublicId = data.imagePublicId;
      await existingCategory.save();
      return existingCategory;
    }

    throw new Error("Category already exists");
  }

  return Category.create({
    name,
    image: data.image,
    imagePublicId: data.imagePublicId,
    isActive: true,
  });
};

export const getCategoryByIdAdmin = async (categoryId: string) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new Error("Category not found");
  }

  return category;
};

// Update category name and optionally replace its image.
export const updateCategory = async (
  categoryId: string,
  data: UpdateCategoryData,
) => {
  const name = data.name.trim();

  if (!name) {
    throw new Error("Category name is required");
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new Error("Category not found");
  }

  const existingCategory = await Category.findOne({
    _id: { $ne: categoryId },
    name: {
      $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  });

  if (existingCategory) {
    throw new Error("Another category with this name already exists");
  }

  category.name = name;

  if (data.image !== undefined) {
    category.image = data.image;
  }

  if (data.imagePublicId !== undefined) {
    category.imagePublicId = data.imagePublicId;
  }

  await category.save();

  return category;
};

// Soft-delete a category. Categories with active products cannot be deleted.
export const deleteCategory = async (categoryId: string) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new Error("Category not found");
  }

  if (!category.isActive) {
    throw new Error("Category is already deleted");
  }

  const productsCount = await Product.countDocuments({
    category: categoryId,
    isActive: true,
  });

  if (productsCount > 0) {
    throw new Error(
      `Cannot delete this category because ${productsCount} active product${productsCount === 1 ? " is" : "s are"} using it.`,
    );
  }

  category.isActive = false;
  await category.save();

  return category;
};
