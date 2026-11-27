import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAddress extends Document {
  user: Types.ObjectId;

  fullName: string;
  phone: string;

  addressLine: string;
  city: string;
  state: string;
  pincode: string;

  latitude?: number;
  longitude?: number;

  isDefault: boolean;
  addressType?: "Home" | "Work" | "Hotel" | "Other";
  buildingName?: string;
  floor?: string;
  towerWing?: string;
  landmark?: string;
  formattedAddress?: string;

  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => /^(?:\+91)?[6-9]\d{9}$/.test(value.replace(/[\s()-]/g, "")),
        message: "Please enter a valid mobile number",
      },
    },

    addressLine: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
    addressType: { type: String, enum: ["Home", "Work", "Hotel", "Other"], default: "Home" },
    buildingName: { type: String, trim: true, maxlength: 120 },
    floor: { type: String, trim: true, maxlength: 40 },
    towerWing: { type: String, trim: true, maxlength: 80 },
    landmark: { type: String, trim: true, maxlength: 120 },
    formattedAddress: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
  },
);

const Address = mongoose.model<IAddress>("Address", addressSchema);

export default Address;
