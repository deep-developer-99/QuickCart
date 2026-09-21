import { Request, Response } from "express";

import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createProduct,
  getAllProducts,
  getVendorProducts,
  getVendorProductById,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  restoreProduct,
} from "../services/productService";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinaryService";

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

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Product image is required",
      });
      return;
    }

    const price = Number(req.body.price);
    const stock = Number(req.body.stock);
    const discountPrice =
      req.body.discountPrice !== undefined && req.body.discountPrice !== ""
        ? Number(req.body.discountPrice)
        : undefined;

    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({
        success: false,
        message: "Please enter a valid price",
      });
      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      res.status(400).json({
        success: false,
        message: "Please enter a valid stock quantity",
      });
      return;
    }

    if (
      discountPrice !== undefined &&
      (!Number.isFinite(discountPrice) || discountPrice < 0)
    ) {
      res.status(400).json({
        success: false,
        message: "Please enter a valid discount price",
      });
      return;
    }

    if (discountPrice !== undefined && discountPrice >= price) {
      res.status(400).json({
        success: false,
        message: "Discount price must be less than the original price",
      });
      return;
    }

    const uploadedImage = await uploadImageToCloudinary(
      req.file.buffer,
      "quickcart/products",
    );

    try {
      const product = await createProduct(
        {
          name: String(req.body.name ?? "").trim(),
          description: String(req.body.description ?? "").trim(),
          image: uploadedImage.secure_url,
          imagePublicId: uploadedImage.public_id,
          price,
          discountPrice,
          stock,
          category: String(req.body.category ?? ""),
        },
        req.user.id,
      );

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      await deleteImageFromCloudinary(uploadedImage.public_id).catch(() => {
        console.error("Failed to clean up uploaded product image.");
      });
      throw error;
    }
  } catch (error) {
    console.error("Create product error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create product",
    });
  }
};

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

export const getProductsByCategoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { categoryId } = req.params as { categoryId: string };

    const products = await getProductsByCategory(categoryId);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products through category error:", error);

    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : "Product not found",
    });
  }
};

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

export const updateProductController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let uploadedImagePublicId: string | undefined;

  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params as { id: string };

    const existingProduct = await getVendorProductById(id, req.user.id);

    let image = existingProduct.image;
    let imagePublicId = existingProduct.imagePublicId;

    if (req.file) {
      const uploadedImage = await uploadImageToCloudinary(
        req.file.buffer,
        "quickcart/products",
      );

      uploadedImagePublicId = uploadedImage.public_id;
      image = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    const price =
      req.body.price !== undefined && req.body.price !== ""
        ? Number(req.body.price)
        : undefined;
    const stock =
      req.body.stock !== undefined && req.body.stock !== ""
        ? Number(req.body.stock)
        : undefined;
    const discountPrice =
      req.body.discountPrice !== undefined && req.body.discountPrice !== ""
        ? Number(req.body.discountPrice)
        : undefined;

    if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
      throw new Error("Please enter a valid price");
    }

    if (stock !== undefined && (!Number.isFinite(stock) || stock < 0)) {
      throw new Error("Please enter a valid stock quantity");
    }

    if (
      discountPrice !== undefined &&
      (!Number.isFinite(discountPrice) || discountPrice < 0)
    ) {
      throw new Error("Please enter a valid discount price");
    }

    const finalPrice = price ?? existingProduct.price;

    if (discountPrice !== undefined && discountPrice >= finalPrice) {
      throw new Error("Discount price must be less than the original price");
    }

    const product = await updateProduct(id, req.user.id, {
      name:
        req.body.name !== undefined ? String(req.body.name).trim() : undefined,
      description:
        req.body.description !== undefined
          ? String(req.body.description).trim()
          : undefined,
      image,
      imagePublicId,
      price,
      discountPrice,
      stock,
      category:
        req.body.category !== undefined ? String(req.body.category) : undefined,
    });

    if (req.file && existingProduct.imagePublicId) {
      await deleteImageFromCloudinary(existingProduct.imagePublicId).catch(
        (error) => {
          console.error("Failed to delete old product image:", error);
        },
      );
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      await deleteImageFromCloudinary(uploadedImagePublicId).catch(() => {
        console.error("Failed to clean up new product image.");
      });
    }

    console.error("Update product error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update product",
    });
  }
};

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
