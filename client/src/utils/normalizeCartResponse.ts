import type { Cart } from "../types/cart";
import { getEntityId } from "./getEntityId";

export const normalizeCartResponse = (response: unknown, fallbackUserId: string): Cart | null => {
  if (!response || typeof response !== "object") return null;
  const envelope = response as { data?: unknown; items?: unknown };
  if ("success" in envelope && envelope.success === false) return null;
  const candidate = envelope.data && typeof envelope.data === "object" && Array.isArray((envelope.data as { items?: unknown }).items)
    ? envelope.data as Record<string, unknown>
    : envelope as Record<string, unknown>;
  if (!Array.isArray(candidate.items)) return null;

  const responseUserId = getEntityId(candidate.user);
  if (responseUserId && fallbackUserId && responseUserId !== fallbackUserId) return null;

  const itemByProductId = new Map<string, Cart["items"][number]>();
  for (const rawItem of candidate.items) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    const quantity = Number(item.quantity);
    const productId = getEntityId(item.product);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;

    const rawProduct = item.product;
    const product = rawProduct && typeof rawProduct === "object"
      ? { ...rawProduct, _id: productId } as Cart["items"][number]["product"]
      : productId;
    const variantId = typeof item.variantId === "string" ? item.variantId : undefined;
    const itemKey = `${productId}:${variantId ?? ""}`;
    const existing = itemByProductId.get(itemKey);
    if (existing) {
      const combinedQuantity = existing.quantity + quantity;
      if (Number.isFinite(combinedQuantity)) {
        existing.quantity = combinedQuantity;
        if (typeof existing.product === "string" && typeof product !== "string") {
          existing.product = product;
        }
      }
    } else {
      itemByProductId.set(itemKey, { product, variantId, quantity });
    }
  }

  const items = [...itemByProductId.values()];

  return {
    _id: String(candidate._id ?? candidate.id ?? ""),
    user: responseUserId ?? fallbackUserId,
    items,
  };
};
