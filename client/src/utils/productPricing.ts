import type { ProductVariant } from "../types/product";

export const getVariantDiscountPrice = (variant?: ProductVariant | null) => {
  const price = Number(variant?.price);
  const discountPrice = Number(variant?.discountPrice);
  return Number.isFinite(price) && price > 0 && Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < price
    ? discountPrice
    : undefined;
};

export const hasVariantDiscount = (variant?: ProductVariant | null) =>
  getVariantDiscountPrice(variant) !== undefined;

export const getVariantSellingPrice = (variant?: ProductVariant | null) =>
  getVariantDiscountPrice(variant) ?? (Number.isFinite(Number(variant?.price)) && Number(variant?.price) > 0 ? Number(variant?.price) : 0);

export const getVariantDiscountPercentage = (variant?: ProductVariant | null) => {
  const discountPrice = getVariantDiscountPrice(variant);
  const price = Number(variant?.price);
  return discountPrice === undefined || !Number.isFinite(price) || price <= 0
    ? 0
    : Math.round(((price - discountPrice) / price) * 100);
};

export const getLowestPricedAvailableVariant = (variants?: ProductVariant[] | null) =>
  (Array.isArray(variants) ? variants : []).reduce<ProductVariant | undefined>((lowest, candidate) => {
    const stock = Number(candidate.stock);
    const price = Number(candidate.price);
    if (candidate.isActive !== true || !Number.isFinite(stock) || stock <= 0 || !Number.isFinite(price) || price <= 0) return lowest;
    return !lowest || getVariantSellingPrice(candidate) < getVariantSellingPrice(lowest) ? candidate : lowest;
  }, undefined);
