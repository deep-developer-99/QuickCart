import Category from "../models/Category";

// Get all active categories
export const getAllCategories = async () => {
  const categories = await Category.find({
    isActive: true,
  }).sort({ name: 1 });

  return categories;
};

// Get category by ID
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
