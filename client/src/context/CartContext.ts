import { createContext } from "react";

import type { Cart } from "../types/cart";

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  isCartReady: boolean;
  cartError: string | null;
  getQuantity: (productId: string, variantId?: string) => number;
  addProduct: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateProductQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  removeProduct: (productId: string, variantId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

export const CartContext = createContext<CartContextValue | undefined>(
  undefined,
);
