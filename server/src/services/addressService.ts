import Address from "../models/Address";
import { createPaginationMeta, getPagination } from "../utils/pagination";
import { optionalCoordinates } from "../utils/optionalCoordinates";

interface CreateAddressData {
  fullName: string;
  phone: string;

  addressLine: string;
  city: string;
  state: string;
  pincode: string;

  latitude?: number;
  longitude?: number;

  isDefault?: boolean;
  addressType?: "Home" | "Work" | "Hotel" | "Other";
  buildingName?: string;
  floor?: string;
  towerWing?: string;
  landmark?: string;
  formattedAddress?: string;
}

interface UpdateAddressData {
  fullName?: string;
  phone?: string;

  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;

  latitude?: number;
  longitude?: number;

  isDefault?: boolean;
  addressType?: "Home" | "Work" | "Hotel" | "Other";
  buildingName?: string;
  floor?: string;
  towerWing?: string;
  landmark?: string;
  formattedAddress?: string;
}

const normalizeAndValidatePhone = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Phone number is required");
  }
  const phone = value.trim();
  const compact = phone.replace(/[\s()-]/g, "");
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(compact)) {
    throw new Error("Please enter a valid mobile number");
  }
  return compact;
};

// Create Address
export const createAddress = async (
  userId: string,
  data: CreateAddressData,
) => {
  const phone = normalizeAndValidatePhone((data as { phone?: unknown }).phone);
  const { latitude: _latitude, longitude: _longitude, ...addressFields } = data;
  const coordinates = optionalCoordinates(data);

  if (data.isDefault) {
    await Address.updateMany(
      { user: userId },
      {
        $set: {
          isDefault: false,
        },
      },
    );
  }

  const address = await Address.create({
    user: userId,
    ...addressFields,
    phone,
    ...coordinates,
  });

  return address;
};

// Get All Addresses
export const getUserAddresses = async (
  userId: string,
  page?: unknown,
  limit?: unknown,
) => {
  const pagination = getPagination(page, limit);
  const filter = { user: userId };
  const [addresses, totalItems] = await Promise.all([
    Address.find(filter)
      .sort({
    isDefault: -1,
    createdAt: -1,
      })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Address.countDocuments(filter),
  ]);

  return {
    data: addresses,
    pagination: createPaginationMeta(
      pagination.page,
      pagination.limit,
      totalItems,
    ),
  };
};

// Get Single Address
export const getAddressById = async (addressId: string, userId: string) => {
  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  return address;
};

// Update Address
export const updateAddress = async (
  addressId: string,
  userId: string,
  data: UpdateAddressData,
) => {
  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  const finalPhone = Object.prototype.hasOwnProperty.call(data, "phone")
    ? normalizeAndValidatePhone((data as { phone?: unknown }).phone)
    : address.phone;
  // Legacy records may have no phone; they remain readable until edited.
  if (!finalPhone) throw new Error("Phone number is required");
  const phone = normalizeAndValidatePhone(finalPhone);
  const { latitude: _latitude, longitude: _longitude, ...addressFields } = data;
  const coordinates = optionalCoordinates(data);

  if (data.isDefault) {
    await Address.updateMany(
      {
        user: userId,
        _id: { $ne: addressId },
      },
      {
        $set: {
          isDefault: false,
        },
      },
    );
  }

  Object.assign(address, addressFields, coordinates, { phone });

  await address.save();

  return address;
};

// Delete Address
export const deleteAddress = async (
  addressId: string,
  userId: string,
): Promise<void> => {
  const address = await Address.findOneAndDelete({
    _id: addressId,
    user: userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }
};

