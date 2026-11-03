import mongoose, { Document, Schema } from "mongoose";

export interface ISearchSuggestion extends Document {
  phrase: string;
  phraseKey: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const searchSuggestionSchema = new Schema<ISearchSuggestion>(
  {
    phrase: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    phraseKey: { type: String, required: true, select: false },
    order: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

searchSuggestionSchema.pre("validate", function () {
  this.phrase = this.phrase.trim();
  this.phraseKey = this.phrase.toLocaleLowerCase();
});
searchSuggestionSchema.index({ phraseKey: 1 }, { unique: true });
searchSuggestionSchema.index({ order: 1, _id: 1 });

export default mongoose.models.SearchSuggestion || mongoose.model<ISearchSuggestion>("SearchSuggestion", searchSuggestionSchema);
