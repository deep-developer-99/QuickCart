import type { Cart } from "../types/cart";

export const normalizeCartResponse = (response: unknown, fallbackUserId: string): Cart | null => {
  if (!response || typeof response !== "object") return null;
  const envelope = response as { data?: unknown; items?: unknown };
  const candidate = envelope.data && typeof envelope.data === "object" && Array.isArray((envelope.data as { items?: unknown }).items)
    ? envelope.data as Record<string, unknown>
    : envelope as Record<string, unknown>;
  if (!Array.isArray(candidate.items)) return null;

  const items = candidate.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const rawProduct = item.product;
      const product = typeof rawProduct === "string"
        ? rawProduct
        : rawProduct && typeof rawProduct === "object"
          ? rawProduct as Cart["items"][number]["product"]
          : "";
      return { product, quantity: Number(item.quantity) };
    })
    .filter((item) => Boolean(item.product));

  return {
    _id: String(candidate._id ?? candidate.id ?? ""),
    user: String(candidate.user ?? fallbackUserId),
    items,
  };
};
