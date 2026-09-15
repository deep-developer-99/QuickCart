import Address from "../models/Address";

interface CreateAddressData {
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

interface updateAddress {
  fullName?: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
}

// Create Address
export const createAddress = async (
  userId: string,
  data: CreateAddressData,
) => {
  if (data.isDefault) {
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
  }

  const address = await Address.create({
    user: userId,
    ...data,
  });

  return address;
};

// Get All Addresses of the User
export const getUserAddresses = async (userId: string) => {
  const address = await Address.find({
    user: userId,
  }).sort({
    isDefault: -1,
    createdAt: -1,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  return address;
};

// Get Single Address of the User
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
  data: updateAddress,
) => {
  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  if (data.isDefault) {
    await Address.updateMany(
      { user: userId, _id: { $ne: addressId } },
      { $set: { isDefault: false } },
    );
  }

  Object.assign(address, data);

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
