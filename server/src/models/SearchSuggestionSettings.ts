import mongoose, { Document, Schema } from "mongoose";

export interface ISearchSuggestionSettings extends Document {
  key: "global";
  isEnabled: boolean;
  rotationInterval: number;
  updatedAt: Date;
}

const schema = new Schema<ISearchSuggestionSettings>(
  {
    key: { type: String, enum: ["global"], unique: true, default: "global" },
    isEnabled: { type: Boolean, default: true },
    rotationInterval: { type: Number, min: 1000, max: 10000, default: 2500, validate: Number.isInteger },
  },
  { timestamps: true },
);

export default mongoose.models.SearchSuggestionSettings || mongoose.model<ISearchSuggestionSettings>("SearchSuggestionSettings", schema);
