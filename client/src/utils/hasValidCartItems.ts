import type { Cart, CartItem } from "../types/cart";
import { getEntityId } from "./getEntityId";

export const isValidCartItem = (item: CartItem) => {
  return Boolean(item && getEntityId(item.product) && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0);
};

export const getValidCartItems = (cart: Cart | null | undefined) =>
  cart?.items.filter(isValidCartItem) ?? [];

export const hasValidCartItems = (cart: Cart | null | undefined) =>
  getValidCartItems(cart).length > 0;

export const getCartProductId = (product: CartItem["product"]) =>
  getEntityId(product);

export const getCartQuantity = (cart: Cart | null | undefined, productId: string) => {
  const normalizedId = getEntityId(productId);
  if (!normalizedId) return 0;
  const item = getValidCartItems(cart).find((cartItem) => getCartProductId(cartItem.product) === normalizedId);
  return item?.quantity ?? 0;
};

export const getCartSubtotal = (items: readonly CartItem[]) => {
  let subtotal = 0;
  for (const item of items) {
    if (!isValidCartItem(item)) continue;
    if (typeof item.product === "string") return null;
    const price = Number(item.product.discountPrice ?? item.product.price);
    if (!Number.isFinite(price) || price < 0) return null;
    subtotal += price * Number(item.quantity);
  }
  return Number.isFinite(subtotal) ? subtotal : null;
};

const indianRupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatIndianRupees = (amount: number) =>
  indianRupeeFormatter.format(amount);
