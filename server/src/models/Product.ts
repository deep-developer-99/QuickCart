import mongoose, { Document, Schema, Types } from "mongoose";

export const PRODUCT_UNITS = ["g", "kg", "ml", "L", "pcs", "pc", "set", "pack", "m", "cm", "dozen", "pair"] as const;
export interface IProductVariant {
  _id: Types.ObjectId;
  quantity: number;
  unit: typeof PRODUCT_UNITS[number];
  price: number;
  stock: number;
  isActive: boolean;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  image: string;
  imagePublicId?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  legacyPrice?: number;
  legacyStock?: number;
  variants?: Types.DocumentArray<IProductVariant>;
  category: Types.ObjectId;
  subCategory?: Types.ObjectId | null;
  vendor: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
    },

    imagePublicId: {
      type: String,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    legacyPrice: { type: Number, min: 0 },
    legacyStock: { type: Number, min: 0 },

    variants: {
      type: [new Schema<IProductVariant>({
        quantity: { type: Number, required: true, min: 0.001 },
        unit: { type: String, required: true, enum: PRODUCT_UNITS },
        price: { type: Number, required: true, min: 0.01 },
        stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
        isActive: { type: Boolean, default: true },
      })],
      default: undefined,
      validate: {
        validator: (variants: IProductVariant[]) => {
          const keys = variants.map((variant) => `${variant.quantity}:${variant.unit}`);
          return new Set(keys).size === keys.length;
        },
        message: "Product variants must have unique quantity and unit combinations",
      },
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    subCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index(
  { subCategory: 1, isActive: 1, stock: 1, createdAt: -1 },
  { name: "product_homepage_section_visibility" },
);

const Product = mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);

export default Product;
