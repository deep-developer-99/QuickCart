import Vendor from "../models/Vendor";

export interface VendorShopLocationUpdate {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export class VendorShopLocationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "VendorShopLocationError";
  }
}

const requiredText = (value: unknown, label: string, maxLength: number) => {
  if (typeof value !== "string") {
    throw new VendorShopLocationError(`${label} is required.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maxLength) {
    throw new VendorShopLocationError(`${label} is invalid.`);
  }
  return normalized;
};

const validateShopLocation = (input: unknown): VendorShopLocationUpdate => {
  if (!input || typeof input !== "object") {
    throw new VendorShopLocationError("Shop details are required.");
  }
  const values = input as Record<string, unknown>;
  const address = requiredText(values.address, "Shop address", 300);
  const city = requiredText(values.city, "City", 100);
  const state = requiredText(values.state, "State", 100);
  const pincode = requiredText(values.pincode, "Postal code", 6);
  if (!/^\d{6}$/.test(pincode)) {
    throw new VendorShopLocationError("Postal code must contain 6 digits.");
  }

  const { latitude, longitude } = values;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new VendorShopLocationError(
      "Select a valid shop location on the map before saving.",
    );
  }

  return { address, city, state, pincode, latitude, longitude };
};

export const updateVendorShopLocation = async (
  vendorId: string,
  input: unknown,
) => {
  const shopLocation = validateShopLocation(input);
  const vendor = await Vendor.findByIdAndUpdate(
    vendorId,
    { $set: shopLocation },
    { new: true, runValidators: true },
  ).select("-password -__v -fcmTokens");

  if (!vendor) {
    throw new VendorShopLocationError("Vendor account was not found.", 404);
  }
  return vendor;
};

export const getVendorShopLocation = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId).select(
    "shopName address city state pincode latitude longitude",
  );
  if (!vendor) {
    throw new VendorShopLocationError("Vendor account was not found.", 404);
  }
  return vendor;
};
