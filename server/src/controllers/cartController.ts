import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../services/cartService";

// Get Cart
export const getCartController = async (
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
    const cart = await getCart(req.user.id);

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error("Get cart error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
    });
  }
};

// Add To Cart
export const addToCartController = async (
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

    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      res.status(400).json({
        success: false,
        message: "Product ID and quantity are required",
      });
      return;
    }

    const cart = await addToCart(req.user.id, productId, quantity);

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to add product to cart",
    });
  }
};

// Update Cart Item
export const updateCartItemController = async (
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

    const { productId } = req.params as {
      productId: string;
    };

    const { quantity } = req.body;

    if (quantity === undefined) {
      res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
      return;
    }

    const cart = await updateCartItem(req.user.id, productId, quantity);

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Update cart error:", error);

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update cart",
    });
  }
};

// Remove From Cart
export const removeFromCartController = async (
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

    const { productId } = req.params as {
      productId: string;
    };

    const cart = await removeFromCart(req.user.id, productId);

    res.status(200).json({
      success: true,
      message: "Product removed from cart",
      data: cart,
    });
  } catch (error) {
    console.error("Remove cart item error:", error);

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to remove product",
    });
  }
};

// Clear Cart
export const clearCartController = async (
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

    await clearCart(req.user.id);

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Clear cart error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    });
  }
};
