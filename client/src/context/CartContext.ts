import { createContext } from "react";

import type { Cart } from "../types/cart";
import type { Product } from "../types/product";

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  isCartReady: boolean;
  cartError: string | null;
  getQuantity: (productId: string, variantId?: string) => number;
  addProduct: (product: Product, quantity?: number, variantId?: string) => Promise<void>;
  updateProductQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  removeProduct: (productId: string, variantId?: string) => Promise<void>;
  removePurchasedItems: (items: Array<{ productId: string; variantId: string; quantity: number }>) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

export const CartContext = createContext<CartContextValue | undefined>(
  undefined,
);
