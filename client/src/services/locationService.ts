import api from "./api";
import { getCurrentLocation } from "./browserLocation";
import type { CurrentLocation } from "./browserLocation";
export { getCurrentLocation } from "./browserLocation";

export interface ReverseGeocodedAddress {
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  displayName: string;
}

export interface DetectedLocation extends CurrentLocation {
  address: ReverseGeocodedAddress;
}

export interface LocationSearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address: Record<string, string | undefined>;
}

const STORAGE_KEY = "quickcart_current_location";

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodedAddress> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error("Unable to find an address for your current location.");
  }
  return extractAddressComponents(await response.json());
};

export const extractAddressComponents = (data: {
  display_name?: string;
  address?: Record<string, string | undefined>;
}): ReverseGeocodedAddress => {
  const address = data.address ?? {};
  const street = [address.house_number, address.road || address.street || address.pedestrian || address.residential]
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

export const reverseGeocodeFromBackend = async (
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodedAddress> => {
  const response = await api.get("/location/reverse", {
    params: { lat: latitude, lon: longitude },
    signal,
  });
  return extractAddressComponents(response.data?.data ?? {});
};

export const searchLocations = async (
  query: string,
  signal?: AbortSignal,
): Promise<LocationSearchResult[]> => {
  const response = await api.post(
    "/location/search",
    { query },
    { signal },
  );
  const results: unknown = response.data?.data;
  if (!Array.isArray(results)) {
    throw new Error("The location service returned an invalid response.");
  }
  return results as LocationSearchResult[];
};

export const detectCurrentLocation = async (): Promise<DetectedLocation> => {
  const location = await getCurrentLocation();

  const address = await reverseGeocode(location.latitude, location.longitude);

  return {
    ...location,
    address,
  };
};

export const saveCurrentLocation = (location: DetectedLocation) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(location));

  window.dispatchEvent(new CustomEvent("quickcart:location-changed"));
};

export const getSavedCurrentLocation = (): DetectedLocation | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as DetectedLocation;
  } catch {
    return null;
  }
};

export const clearSavedCurrentLocation = () => {
  localStorage.removeItem(STORAGE_KEY);

  window.dispatchEvent(new CustomEvent("quickcart:location-changed"));
};
