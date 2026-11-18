import { Types } from "mongoose";
import Cart from "../models/Cart";
import Product from "../models/Product";

export interface CheckoutCartLineInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ResolvedCheckoutItem {
  product: any;
  quantity: number;
  itemTotal: number;
  discountedPrice: number;
  variantId: Types.ObjectId;
  variantQuantity: number;
  variantUnit: string;
  price: number;
  discountPrice?: number;
}

export const normalizeCheckoutItems = (items: unknown): CheckoutCartLineInput[] => {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new Error("Cart items must contain between 1 and 50 products");
  }

  const seen = new Set<string>();
  return items.map((item) => {
    const line = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const productId = typeof line.productId === "string" ? line.productId.toLowerCase() : "";
    const variantId = typeof line.variantId === "string" ? line.variantId.toLowerCase() : "";
    const quantity = line.quantity;
    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(variantId)) {
      throw new Error("Each cart item must include a valid product and variant");
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Cart item quantity must be between 1 and 99");
    }
    const key = `${productId}:${variantId}`;
    if (seen.has(key)) throw new Error("Cart contains duplicate product variants");
    seen.add(key);
    return { productId, variantId, quantity };
  });
};

export const calculateCheckout = async (
  userId: string,
  donationSelected = false,
  requestedItems?: unknown,
) => {
  let lines: CheckoutCartLineInput[];
  if (requestedItems !== undefined) {
    lines = normalizeCheckoutItems(requestedItems);
  } else {
    // Compatibility for older/external clients. New web and mobile clients send
    // local cart identifiers and quantities, so normal checkout skips this read.
    const cart = await Cart.findOne({ user: userId });
    lines = (cart?.items ?? []).map((item: any) => ({
      productId: item.product.toString(),
      variantId: item.variantId?.toString() ?? "",
      quantity: item.quantity,
    }));
    if (lines.length === 0) throw new Error("Cart is empty");
  }

  let subtotal = 0;
  const items: ResolvedCheckoutItem[] = [];
  for (const line of lines) {
    const product = await Product.findOne({ _id: line.productId, isActive: true });
    if (!product) throw new Error("One or more products are no longer available");
    const variant = product.variants?.find(
      (entry: any) => entry._id.toString() === line.variantId && entry.isActive,
    );
    if (!variant) throw new Error(`Select a valid variant for ${product.name} before checkout`);
    if (variant.stock < line.quantity) throw new Error(`Insufficient stock for ${product.name}`);

    const discountedPrice = variant.discountPrice != null && variant.discountPrice < variant.price
      ? variant.discountPrice
      : variant.price;
    const itemTotal = discountedPrice * line.quantity;
    subtotal += itemTotal;
    items.push({
      product,
      quantity: line.quantity,
      itemTotal,
      discountedPrice,
      variantId: variant._id,
      variantQuantity: variant.quantity,
      variantUnit: variant.unit,
      price: variant.price,
      discountPrice: variant.discountPrice,
    });
  }

  const shippingAmount = subtotal <= 99 ? 40 : 0;
  const donationAmount = donationSelected ? 1 : 0;
  return {
    items,
    subtotal,
    shippingAmount,
    donationAmount,
    totalAmount: subtotal + shippingAmount + donationAmount,
  };
};
