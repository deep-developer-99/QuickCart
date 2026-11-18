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
  addressType?: "Home" | "Work" | "Hotel" | "Other";
  buildingName?: string;
  floor?: string;
  towerWing?: string;
  landmark?: string;
  formattedAddress?: string;
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
  addressType?: "Home" | "Work" | "Hotel" | "Other";
  buildingName?: string;
  floor?: string;
  towerWing?: string;
  landmark?: string;
  formattedAddress?: string;
}
