export interface ReverseGeocodedAddress {
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  displayName: string;
}

export interface VendorAddressFields {
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export const extractAddressComponents = (data: {
  display_name?: string;
  address?: Record<string, string | undefined>;
}): ReverseGeocodedAddress => {
  const address = data.address ?? {};
  const streetName =
    address.road || address.street || address.pedestrian || address.residential;
  const building = address.house_name || address.building;
  const street = [
    address.house_number || building,
    streetName,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(", ");
  const city =
    address.city || address.town || address.village || address.municipality;
  const postcode = address.postcode?.trim() ?? "";
  return {
    addressLine: street,
    city: city?.trim() ?? "",
    state: address.state?.trim() ?? "",
    pincode: /^\d{6}$/.test(postcode) ? postcode : "",
    displayName: data.display_name ?? "",
  };
};

export const addressFieldsFromProvider = (
  address: ReverseGeocodedAddress,
): Partial<VendorAddressFields> => ({
  ...(address.addressLine.trim() ? { address: address.addressLine.trim() } : {}),
  ...(address.city.trim() ? { city: address.city.trim() } : {}),
  ...(address.state.trim() ? { state: address.state.trim() } : {}),
  ...(address.pincode.trim() ? { pincode: address.pincode.trim() } : {}),
});
