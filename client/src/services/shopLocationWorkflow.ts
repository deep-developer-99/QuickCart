import { addressFieldsFromProvider } from "./locationAddress";
import type { VendorAddressFields, ReverseGeocodedAddress } from "./locationAddress";
import type { CurrentLocation } from "./browserLocation";

export interface ShopCoordinates {
  latitude: number;
  longitude: number;
}

export interface CurrentShopLocationResult {
  coordinates: ShopCoordinates;
  addressFields: Partial<VendorAddressFields>;
  lookupFailed?: boolean;
  lookupError?: unknown;
}

export const locateAndReverseGeocodeShop = async (
  getPosition: () => Promise<CurrentLocation>,
  reverseGeocode: (
    latitude: number,
    longitude: number,
  ) => Promise<ReverseGeocodedAddress>,
  onCoordinatesSelected: (coordinates: ShopCoordinates) => void,
): Promise<CurrentShopLocationResult> => {
  const position = await getPosition();
  const coordinates = {
    latitude: position.latitude,
    longitude: position.longitude,
  };

  // Update the selected pin before waiting for the address provider.
  onCoordinatesSelected(coordinates);

  try {
    const address = await reverseGeocode(
      coordinates.latitude,
      coordinates.longitude,
    );
    return {
      coordinates,
      addressFields: addressFieldsFromProvider(address),
    };
  } catch (lookupError: unknown) {
    return {
      coordinates,
      addressFields: {},
      lookupFailed: true,
      lookupError,
    };
  }
};
