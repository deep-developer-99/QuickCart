import mongoose, { Document, Schema } from "mongoose";

export type MobileBannerRedirectType = "none" | "category" | "subcategory" | "product";

export interface IMobileBanner extends Document {
  title: string;
  image: string;
  imagePublicId: string;
  redirectType: MobileBannerRedirectType;
  redirectTarget?: string;
  displayOrder: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mobileBannerSchema = new Schema<IMobileBanner>({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  image: { type: String, required: true },
  imagePublicId: { type: String, required: true },
  redirectType: { type: String, enum: ["none", "category", "subcategory", "product"], required: true, default: "none" },
  redirectTarget: { type: String, trim: true },
  displayOrder: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Display order must be a whole number." } },
  isActive: { type: Boolean, required: true, default: true },
  startDate: { type: Date },
  endDate: { type: Date },
}, { timestamps: true });

mobileBannerSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 });

const MobileBanner = mongoose.models.MobileBanner || mongoose.model<IMobileBanner>("MobileBanner", mobileBannerSchema);
export default MobileBanner;
