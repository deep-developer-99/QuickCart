export interface Address {
  _id: string;
  user: string;

  fullName: string;
  phone: string;

  addressLine: string;
  city: string;
  state: string;
  pincode: string;

  latitude?: number;
  longitude?: number;

  isDefault: boolean;
}

export interface CreateAddressData {
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
