import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import axios from "axios";

import { useAppSelector } from "../hooks/reduxHooks";
import {
  addToCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cartService";

import type { Cart } from "../types/cart";

import { CartContext } from "./CartContext";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAppSelector((state) => state.auth);

  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isUser = isAuthenticated && user?.role === "user";

  const refreshCart = async () => {
    if (!isUser) {
      setCart(null);
      return;
    }

    try {
      setIsLoading(true);

      const response = await getCart();

      if (response?.success) {
        setCart(response.data || null);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setCart(null);
      } else {
        console.error("Failed to load cart:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isUser) {
      setCart(null);
      return;
    }

    void refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isUser]);

  const addProduct = async (productId: string, quantity = 1) => {
    await addToCart(productId, quantity);
    await refreshCart();
  };

  const updateProductQuantity = async (productId: string, quantity: number) => {
    if (quantity < 1) {
      await removeProduct(productId);
      return;
    }

    await updateCartItem(productId, quantity);
    await refreshCart();
  };

  const removeProduct = async (productId: string) => {
    await removeCartItem(productId);
    await refreshCart();
  };

  const getQuantity = (productId: string) => {
    const item = cart?.items.find((cartItem) => {
      const itemProductId =
        typeof cartItem.product === "string"
          ? cartItem.product
          : cartItem.product?._id;

      return itemProductId === productId;
    });

    return item?.quantity ?? 0;
  };

  const value = {
    cart,
    isLoading,
    getQuantity,
    addProduct,
    updateProductQuantity,
    removeProduct,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
