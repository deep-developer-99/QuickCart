import type { Cart, CartItem } from "../types/cart";

export const isValidCartItem = (item: CartItem) => {
  const product = item.product;
  return Boolean(
    product &&
    typeof product === "object" &&
    product._id &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0,
  );
};

export const getValidCartItems = (cart: Cart | null | undefined) =>
  cart?.items.filter(isValidCartItem) ?? [];

export const hasValidCartItems = (cart: Cart | null | undefined) =>
  getValidCartItems(cart).length > 0;
