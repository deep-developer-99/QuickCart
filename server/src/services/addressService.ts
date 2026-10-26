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
}

// Create Address
export const createAddress = async (
  userId: string,
  data: CreateAddressData,
) => {
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
  const { latitude: _latitude, longitude: _longitude, ...addressFields } = data;
  const coordinates = optionalCoordinates(data);
  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

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

  Object.assign(address, addressFields, coordinates);

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
