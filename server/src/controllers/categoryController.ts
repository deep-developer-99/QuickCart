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
  createSubcategory,
  deleteSubcategory,
  getAdminSubcategories,
  getSubcategoriesByParent,
  getSubcategoryByIdAdmin,
  updateSubcategory,
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

export const getSubcategoriesByParentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const data = await getSubcategoriesByParent(id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    const candidate = error as { statusCode?: number; message?: string };
    res.status(candidate.statusCode || 404).json({
      success: false,
      message: candidate.message || "Failed to fetch subcategories.",
    });
  }
};

// Get all categories for admin.
export const getAllCategoriesAdminController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const categories = await getAllCategoriesAdmin(req.query.page, req.query.limit);

    res.status(200).json({
      success: true,
      ...categories,
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
        description: String(req.body.description || "").trim(),
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
        description: String(req.body.description || "").trim(),
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

const sendSubcategoryError = (res: Response, error: unknown, fallback: string) => {
  const candidate = error as { statusCode?: number; productsCount?: number; message?: string };
  res.status(candidate.statusCode || 400).json({
    success: false,
    message: candidate.message || fallback,
    ...(candidate.productsCount !== undefined ? { productsCount: candidate.productsCount } : {}),
  });
};

const parseActive = (value: unknown): boolean | undefined => {
  if (value === undefined || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error("isActive must be true or false.");
};

export const getAdminSubcategoriesController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await getAdminSubcategories({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      parentCategory: req.query.parentCategory,
      isActive: req.query.isActive,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendSubcategoryError(res, error, "Failed to fetch subcategories.");
  }
};

export const createSubcategoryController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let uploadedPublicId: string | undefined;
  try {
    const name = String(req.body?.name ?? "").trim();
    const parentCategory = String(req.body?.parentCategory ?? "").trim();
    if (!name) throw new Error("Subcategory name is required.");
    if (!parentCategory) throw new Error("Select a main category.");
    if (!req.file) throw new Error("A subcategory image is required.");

    const uploaded = await uploadImageToCloudinary(req.file.buffer, "quickcart/categories/subcategories");
    uploadedPublicId = uploaded.public_id;
    const data = await createSubcategory({
      name,
      description: String(req.body.description || "").trim(),
      parentCategory,
      image: uploaded.secure_url,
      imagePublicId: uploaded.public_id,
      isActive: parseActive(req.body?.isActive) ?? true,
    });
    uploadedPublicId = undefined;
    res.status(201).json({ success: true, message: "Subcategory created successfully.", data });
  } catch (error) {
    if (uploadedPublicId) await deleteImageFromCloudinary(uploadedPublicId).catch(() => undefined);
    sendSubcategoryError(res, error, "Failed to create subcategory.");
  }
};

export const updateSubcategoryController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let uploadedPublicId: string | undefined;
  try {
    const { id } = req.params as { id: string };
    const current = await getSubcategoryByIdAdmin(id);
    const name = String(req.body?.name ?? "").trim();
    const parentCategory = String(req.body?.parentCategory ?? "").trim();
    if (!name) throw new Error("Subcategory name is required.");
    if (!parentCategory) throw new Error("Select a main category.");

    let image: string | undefined;
    let imagePublicId: string | undefined;
    if (req.file) {
      const uploaded = await uploadImageToCloudinary(req.file.buffer, "quickcart/categories/subcategories");
      uploadedPublicId = uploaded.public_id;
      image = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const data = await updateSubcategory(id, {
      name,
      description: String(req.body.description || "").trim(),
      parentCategory,
      image,
      imagePublicId,
      isActive: parseActive(req.body?.isActive),
    });

    if (uploadedPublicId && current.imagePublicId && current.imagePublicId !== uploadedPublicId) {
      await deleteImageFromCloudinary(current.imagePublicId).catch((error) => {
        console.error("Failed to delete previous subcategory image from Cloudinary:", error);
      });
    }
    uploadedPublicId = undefined;
    res.status(200).json({ success: true, message: "Subcategory updated successfully.", data });
  } catch (error) {
    if (uploadedPublicId) await deleteImageFromCloudinary(uploadedPublicId).catch(() => undefined);
    sendSubcategoryError(res, error, "Failed to update subcategory.");
  }
};

export const deleteSubcategoryController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await deleteSubcategory(id);
    res.status(200).json({
      success: true,
      message: "Subcategory deactivated successfully.",
      productsCount: result.productsCount,
      data: result.subcategory,
    });
  } catch (error) {
    sendSubcategoryError(res, error, "Failed to delete subcategory.");
  }
};
