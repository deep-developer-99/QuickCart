import mongoose, { Schema, Types } from "mongoose";

export interface MobileNavigationItem {
  category: Types.ObjectId;
  displayName?: string;
  icon?: string;
  iconPublicId?: string;
  isActive: boolean;
}

export interface MobileNavigationConfig {
  key: string;
  revision: number;
  items: MobileNavigationItem[];
}

const itemSchema = new Schema<MobileNavigationItem>({
  category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  displayName: { type: String, trim: true, maxlength: 40 },
  icon: { type: String, trim: true },
  iconPublicId: { type: String },
  isActive: { type: Boolean, required: true },
}, { _id: false, timestamps: true });

const schema = new Schema<MobileNavigationConfig>({
  key: { type: String, required: true, unique: true },
  revision: { type: Number, required: true, default: 0 },
  items: { type: [itemSchema], default: [] },
}, { timestamps: true });

export default mongoose.models.MobileCategoryNavigation || mongoose.model<MobileNavigationConfig>("MobileCategoryNavigation", schema);
