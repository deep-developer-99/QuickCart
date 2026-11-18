import type { Cart, CartItem } from "../types/cart";

export interface PurchasedCartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export const removePurchasedCartSnapshot = (
  cart: Cart,
  ownerId: string,
  purchased: PurchasedCartLine[],
): Cart => {
  if (cart.user !== ownerId || purchased.length === 0) return cart;

  const quantities = new Map(purchased.map((item) => [`${item.productId}:${item.variantId}`, item.quantity]));
  const items: CartItem[] = cart.items.flatMap((item) => {
    const productId = typeof item.product === "string" ? item.product : item.product?._id;
    const key = `${productId ?? ""}:${item.variantId ?? ""}`;
    const remaining = item.quantity - (quantities.get(key) ?? 0);
    return remaining > 0 ? [{ ...item, quantity: remaining }] : [];
  });

  return { ...cart, items };
};
