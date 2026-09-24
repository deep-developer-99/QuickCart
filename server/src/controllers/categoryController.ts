import { Request, Response } from "express";

import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  getAllCategories,
  getCategoryById,
  getAllCategoriesAdmin,
  getCategoryByIdAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categoryService";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinaryService";

// Get all active categories.
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

// Get category by ID.
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

// Get all categories for admin.
export const getAllCategoriesAdminController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const categories = await getAllCategoriesAdmin();

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get admin categories error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// Create category with an optional image.
export const createCategoryController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let uploadedImagePublicId: string | undefined;

  try {
    const name = String(req.body.name || "").trim();

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Category name is required",
      });
      return;
    }

    let image: string | undefined;
    let imagePublicId: string | undefined;

    if (req.file) {
      const uploadedImage = await uploadImageToCloudinary(
        req.file.buffer,
        "quickcart/categories",
      );

      uploadedImagePublicId = uploadedImage.public_id;
      image = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    try {
      const category = await createCategory({
        name,
        image,
        imagePublicId,
      });

      uploadedImagePublicId = undefined;

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      if (uploadedImagePublicId) {
        await deleteImageFromCloudinary(uploadedImagePublicId).catch(() => {
          console.error("Failed to clean up category image.");
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Create category error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create category",
    });
  }
};

// Update category name and optionally replace its image.
export const updateCategoryController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let uploadedImagePublicId: string | undefined;

  try {
    const { id } = req.params as { id: string };
    const name = String(req.body.name || "").trim();

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Category name is required",
      });
      return;
    }

    const currentCategory = await getCategoryByIdAdmin(id);

    let image: string | undefined;
    let imagePublicId: string | undefined;

    if (req.file) {
      const uploadedImage = await uploadImageToCloudinary(
        req.file.buffer,
        "quickcart/categories",
      );

      uploadedImagePublicId = uploadedImage.public_id;
      image = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    try {
      const category = await updateCategory(id, {
        name,
        image,
        imagePublicId,
      });

      if (
        req.file &&
        currentCategory.imagePublicId &&
        currentCategory.imagePublicId !== category.imagePublicId
      ) {
        await deleteImageFromCloudinary(currentCategory.imagePublicId).catch(
          (error) => {
            console.error(
              "Failed to delete previous category image from Cloudinary:",
              error,
            );
          },
        );
      }

      uploadedImagePublicId = undefined;

      res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: category,
      });
    } catch (error) {
      if (uploadedImagePublicId) {
        await deleteImageFromCloudinary(uploadedImagePublicId).catch(() => {
          console.error("Failed to clean up new category image.");
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Update category error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update category",
    });
  }
};

// Soft-delete category and remove its Cloudinary image when possible.
export const deleteCategoryController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const category = await deleteCategory(id);

    if (category.imagePublicId) {
      await deleteImageFromCloudinary(category.imagePublicId).catch((error) => {
        console.error(
          "Failed to delete category image from Cloudinary:",
          error,
        );
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete category",
    });
  }
};
