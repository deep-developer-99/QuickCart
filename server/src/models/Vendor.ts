import mongoose, { Document, Schema } from "mongoose";

export interface IVendor extends Document {
  name: string;
  email: string;
  password: string;
  shopName: string;
  phone?: string;
  address?: string;
  isApproved: boolean;
  isActive: boolean;
  status: "pending" | "approved" | "rejected";
  role: "vendor";
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ["vendor"],
      default: "vendor",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

const Vendor = mongoose.model<IVendor>("Vendor", vendorSchema);

export default Vendor;
