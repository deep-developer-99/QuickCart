import { createContext } from "react";

import type { Cart } from "../types/cart";

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  getQuantity: (productId: string) => number;
  addProduct: (productId: string, quantity?: number) => Promise<void>;
  updateProductQuantity: (productId: string, quantity: number) => Promise<void>;
  removeProduct: (productId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
}

export const CartContext = createContext<CartContextValue | undefined>(
  undefined,
);
