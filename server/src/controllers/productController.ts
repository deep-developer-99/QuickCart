import { Request, Response } from "express";

import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createProduct,
  getAllProducts,
  getVendorProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  restoreProduct,
} from "../services/productService";

// Create Product
export const createProductController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const product = await createProduct(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create product",
    });
  }
};

// Get All Products
export const getAllProductsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { search, category } = req.query;

    const products = await getAllProducts(
      search as string | undefined,
      category as string | undefined,
    );

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// Get Product By Id
export const getProductByIdController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const product = await getProductById(id);

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : "Product not found",
    });
  }
};

// Get Vendor's Product
export const getVendorProductsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const products = await getVendorProducts(req.user.id);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get vendor products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor products",
    });
  }
};

// Update Product
export const updateProductController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params as { id: string };

    const product = await updateProduct(id, req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update product",
    });
  }
};

// Delete Product Controller
export const deleteProductController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params as { id: string };

    await deleteProduct(id, req.user.id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete product",
    });
  }
};

// Restore Product
export const restoreProductController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params as { id: string };

    const product = await restoreProduct(id, req.user.id);

    res.status(200).json({
      success: true,
      message: "Product restored successfully",
      data: product,
    });
  } catch (error) {
    console.error("Restore product error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to restore product",
    });
  }
};
