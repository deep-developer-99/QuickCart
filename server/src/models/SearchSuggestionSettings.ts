import mongoose, { Document, Schema } from "mongoose";

export const MIN_ANIMATION_SPEED = 20;
export const MAX_ANIMATION_SPEED = 150;
export const DEFAULT_TYPING_SPEED = 60;
export const DEFAULT_DELETING_SPEED = 40;

export interface SearchSuggestionTiming {
  isEnabled: boolean;
  rotationInterval: number;
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
}

export interface ISearchSuggestionSettings extends Document, SearchSuggestionTiming {
  key: "global";
  updatedAt: Date;
}

const schema = new Schema<ISearchSuggestionSettings>(
  {
    key: { type: String, enum: ["global"], unique: true, default: "global" },
    isEnabled: { type: Boolean, default: true },
    typingSpeedMs: { type: Number, min: MIN_ANIMATION_SPEED, max: MAX_ANIMATION_SPEED, default: DEFAULT_TYPING_SPEED, validate: Number.isInteger },
    deletingSpeedMs: { type: Number, min: MIN_ANIMATION_SPEED, max: MAX_ANIMATION_SPEED, default: DEFAULT_DELETING_SPEED, validate: Number.isInteger },
    rotationInterval: { type: Number, min: 1000, max: 10000, default: 2500, validate: Number.isInteger },
  },
  { timestamps: true },
);

export default mongoose.models.SearchSuggestionSettings || mongoose.model<ISearchSuggestionSettings>("SearchSuggestionSettings", schema);
