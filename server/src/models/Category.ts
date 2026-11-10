import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description?: string;
  parentCategory: Types.ObjectId | null;
  normalizedName: string;
  image?: string;
  imagePublicId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    normalizedName: {
      type: String,
      required: true,
      select: false,
    },

    image: {
      type: String,
    },

    imagePublicId: {
      type: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    // Index changes are applied by the reviewed migration script, not at app startup.
    autoIndex: false,
  },
);

categorySchema.pre("validate", function () {
  this.name = this.name.trim();
  this.normalizedName = this.name.normalize("NFKC").toLocaleLowerCase("en");
});

categorySchema.index(
  { parentCategory: 1, normalizedName: 1 },
  { unique: true, name: "category_parent_normalized_name_unique" },
);

const Category = mongoose.models.Category || mongoose.model<ICategory>("Category", categorySchema);

export default Category;
