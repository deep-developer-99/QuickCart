import mongoose, { Document, Schema } from "mongoose";

export type BannerRedirectType = "category" | "product" | "url";

export interface IBanner extends Document {
  title: string;
  subtitle?: string;
  image: string;
  imagePublicId?: string;
  mobileImage?: string;
  mobileImagePublicId?: string;
  buttonText?: string;
  redirectType: BannerRedirectType;
  redirectValue?: string;
  order: number;
  backgroundColor: string;
  textColor: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 240,
    },

    image: {
      type: String,
      required: true,
    },

    imagePublicId: {
      type: String,
    },

    mobileImage: {
      type: String,
    },

    mobileImagePublicId: {
      type: String,
    },

    buttonText: {
      type: String,
      trim: true,
      maxlength: 40,
    },

    redirectType: {
      type: String,
      enum: ["category", "product", "url"],
      default: "category",
    },

    redirectValue: {
      type: String,
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
      min: 0,
    },

    backgroundColor: {
      type: String,
      default: "#e9f6e7",
      trim: true,
    },

    textColor: {
      type: String,
      default: "#172033",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

bannerSchema.index({ isActive: 1, order: 1, startDate: 1, endDate: 1 });

const Banner =
  mongoose.models.Banner || mongoose.model<IBanner>("Banner", bannerSchema);

export default Banner;
