import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { PRODUCT_UNITS } from "../models/Product";

type RawVariant = {
  _id?: Types.ObjectId | string;
  quantity?: unknown;
  unit?: unknown;
  price?: unknown;
  discountPrice?: unknown;
  stock?: unknown;
  isActive?: unknown;
};

const isValidVariantSet = (variants: RawVariant[]) => {
  if (!variants.length) return { valid: false, reason: "No variants exist; a real quantity and unit must be entered by a vendor." };
  const seen = new Set<string>();
  for (const variant of variants) {
    const quantity = Number(variant.quantity);
    const price = Number(variant.price);
    const stock = Number(variant.stock);
    const key = `${quantity}:${String(variant.unit)}`;
    if (!Number.isFinite(quantity) || quantity <= 0) return { valid: false, reason: "A variant quantity is missing or invalid." };
    if (!(PRODUCT_UNITS as readonly unknown[]).includes(variant.unit)) return { valid: false, reason: "A variant unit is missing or unsupported." };
    if (!Number.isFinite(price) || price <= 0) return { valid: false, reason: "A variant regular price is missing or invalid." };
    if (variant.discountPrice != null && (!Number.isFinite(Number(variant.discountPrice)) || Number(variant.discountPrice) < 0 || Number(variant.discountPrice) > price)) return { valid: false, reason: "A variant discount price is invalid." };
    if (!Number.isInteger(stock) || stock < 0) return { valid: false, reason: "A variant stock value is missing or invalid." };
    if (seen.has(key)) return { valid: false, reason: "Duplicate variant quantity and unit values exist." };
    seen.add(key);
  }
  return { valid: true, reason: undefined };
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  const products = mongoose.connection.collection("products");
  const rows = await products.find({}, { projection: { variants: 1, price: 1, discountPrice: 1, stock: 1, legacyPricingReview: 1 } }).toArray();
  const summary = { mode: apply ? "apply" : "dry-run", total: rows.length, variantsReady: 0, needsReview: 0, legacyFieldsFound: 0, variantIdsAssigned: 0, updated: 0 };
  const operations: mongoose.AnyBulkWriteOperation[] = [];

  for (const row of rows) {
    const variants = Array.isArray(row.variants) ? row.variants as RawVariant[] : [];
    const result = isValidVariantSet(variants);
    const hasLegacyFields = row.price !== undefined || row.discountPrice !== undefined || row.stock !== undefined;
    if (hasLegacyFields) summary.legacyFieldsFound += 1;

    const set: Record<string, unknown> = {};
    if (result.valid) {
      summary.variantsReady += 1;
      const normalizedVariants = variants.map((variant) => {
        if (variant._id && Types.ObjectId.isValid(String(variant._id))) return variant;
        summary.variantIdsAssigned += 1;
        return { ...variant, _id: new Types.ObjectId() };
      });
      if (normalizedVariants.some((variant, index) => variant !== variants[index])) set.variants = normalizedVariants;
      if (row.legacyPricingReview?.status === "needs_review") set["legacyPricingReview.status"] = "reviewed";
    } else {
      summary.needsReview += 1;
      set["legacyPricingReview.status"] = "needs_review";
      set["legacyPricingReview.reason"] = result.reason;
    }

    if (hasLegacyFields && !row.legacyPricingReview) {
      set.legacyPricingReview = {
        status: result.valid ? "variants_verified" : "needs_review",
        ...(typeof row.price === "number" ? { sourcePrice: row.price } : {}),
        ...(typeof row.discountPrice === "number" ? { sourceDiscountPrice: row.discountPrice } : {}),
        ...(typeof row.stock === "number" ? { sourceStock: row.stock } : {}),
        ...(!result.valid ? { reason: result.reason } : {}),
      };
    }

    if (Object.keys(set).length || hasLegacyFields) {
      operations.push({ updateOne: {
        filter: { _id: row._id },
        update: {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(hasLegacyFields ? { $unset: { price: "", discountPrice: "", stock: "" } } : {}),
        },
      } });
    }
  }

  if (apply) {
    for (let index = 0; index < operations.length; index += 500) {
      const result = await products.bulkWrite(operations.slice(index, index + 500) as any[], { ordered: true });
      summary.updated += result.modifiedCount;
    }
  }
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
};

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Variant pricing migration failed.");
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
