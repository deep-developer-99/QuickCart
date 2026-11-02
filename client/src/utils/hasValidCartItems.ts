import type { Cart, CartItem } from "../types/cart";

export const isValidCartItem = (item: CartItem) => {
  return Boolean(item && Number(item.quantity) > 0);
};

export const getValidCartItems = (cart: Cart | null | undefined) =>
  cart?.items.filter(isValidCartItem) ?? [];

export const hasValidCartItems = (cart: Cart | null | undefined) =>
  getValidCartItems(cart).length > 0;

export const getCartProductId = (product: CartItem["product"]) =>
  typeof product === "string" ? product : product?._id;
