import { createContext } from "react";

export interface CartDrawerContextValue {
  openCart: () => void;
  closeCart: (navigateTo?: string) => void;
}

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

export default CartDrawerContext;
