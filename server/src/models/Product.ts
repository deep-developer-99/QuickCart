import mongoose, { Document, Schema, Types } from "mongoose";

export const PRODUCT_UNITS = ["g", "kg", "ml", "L", "pcs", "pc", "set", "pack", "m", "cm", "dozen", "pair"] as const;

export interface IProductVariant {
  _id: Types.ObjectId;
  image?: string;
  quantity: number;
  unit: typeof PRODUCT_UNITS[number];
  price: number;
  discountPrice?: number;
  stock: number;
  isActive: boolean;
}

export interface ILegacyPricingReview {
  status: "needs_review" | "reviewed" | "variants_verified";
  sourcePrice?: number;
  sourceDiscountPrice?: number;
  sourceStock?: number;
  reason?: string;
  reviewedAt?: Date;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  image: string;
  imagePublicId?: string;
  variants: Types.DocumentArray<IProductVariant>;
  legacyPricingReview?: ILegacyPricingReview;
  category: Types.ObjectId;
  subCategory?: Types.ObjectId | null;
  vendor: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IProductVariant>({
  image: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0.001 },
  unit: { type: String, required: true, enum: PRODUCT_UNITS },
  price: { type: Number, required: true, min: 0.01 },
  discountPrice: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  isActive: { type: Boolean, default: true },
});

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    imagePublicId: { type: String },
    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator: (variants: IProductVariant[]) => {
          const keys = variants.map((variant) => `${variant.quantity}:${variant.unit}`);
          return new Set(keys).size === keys.length;
        },
        message: "Products need variants with unique quantity and unit combinations",
      },
    },
    legacyPricingReview: {
      status: { type: String, enum: ["needs_review", "reviewed", "variants_verified"] },
      sourcePrice: { type: Number },
      sourceDiscountPrice: { type: Number },
      sourceStock: { type: Number },
      reason: { type: String },
      reviewedAt: { type: Date },
    },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subCategory: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index(
  { subCategory: 1, isActive: 1, "variants.isActive": 1, "variants.stock": 1, createdAt: -1 },
  { name: "product_homepage_section_visibility" },
);

const Product = mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);

export default Product;
