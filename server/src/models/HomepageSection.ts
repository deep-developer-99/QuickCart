import mongoose, { Document, Schema, Types } from "mongoose";

export interface IHomepageSection extends Document {
  subCategory: Types.ObjectId;
  displayOrder: number;
  isActive: boolean;
  productLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const homepageSectionSchema = new Schema<IHomepageSection>(
  {
    subCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    displayOrder: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "Display order must be an integer." },
    },
    isActive: { type: Boolean, default: true },
    productLimit: {
      type: Number,
      default: 15,
      min: 1,
      max: 15,
      validate: { validator: Number.isInteger, message: "Product limit must be an integer." },
    },
  },
  { timestamps: true },
);

homepageSectionSchema.index({ subCategory: 1 }, { unique: true, name: "homepage_section_subcategory_unique" });
homepageSectionSchema.index({ isActive: 1, displayOrder: 1 }, { name: "homepage_section_active_order" });

const HomepageSection = mongoose.models.HomepageSection || mongoose.model<IHomepageSection>("HomepageSection", homepageSectionSchema);

export default HomepageSection;
