import { Request, Response } from "express";

import { getAllCategories, getCategoryById } from "../services/categoryService";

// Get all categories
export const getAllCategoriesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const categories = await getAllCategories();

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// Get category by ID
export const getCategoryByIdController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const category = await getCategoryById(id);

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get category error:", error);

    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : "Category not found",
    });
  }
};
