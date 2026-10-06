import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  isProductInWishlist,
} from "../services/wishlistService";

export const getWishlistController = async (
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

    const wishlist = await getWishlist(req.user.id);

    res.status(200).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
    });
  }
};

export const addToWishlistController = async (
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

    const { productId } = req.body;

    if (!productId || typeof productId !== "string") {
      res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
      return;
    }

    const wishlist = await addToWishlist(req.user.id, productId);

    res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      data: wishlist,
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to add product to wishlist",
    });
  }
};

export const removeFromWishlistController = async (
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

    const { productId } = req.params as { productId: string };

    const wishlist = await removeFromWishlist(req.user.id, productId);

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      data: wishlist,
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to remove product from wishlist",
    });
  }
};

export const clearWishlistController = async (
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

    await clearWishlist(req.user.id);

    res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
    });
  } catch (error) {
    console.error("Clear wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to clear wishlist",
    });
  }
};

export const checkWishlistController = async (
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

    const { productId } = req.params as { productId: string };

    const isWishlisted = await isProductInWishlist(req.user.id, productId);

    res.status(200).json({
      success: true,
      data: {
        isWishlisted,
      },
    });
  } catch (error) {
    console.error("Check wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check wishlist",
    });
  }
};
