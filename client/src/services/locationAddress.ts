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

type ProviderAddressComponents = Record<string, string | undefined>;

const firstComponent = (
  values: ProviderAddressComponents,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = values[key]?.trim();
    if (value) return value;
  }
  return "";
};

const firstLocality = (
  normalized: ProviderAddressComponents,
  components: ProviderAddressComponents,
): string => {
  const localityKeys = [
    "city",
    "town",
    "municipality",
    "village",
    "locality",
    "hamlet",
    "borough",
    "city_district",
    "state_district",
    "suburb",
    "neighbourhood",
    "neighborhood",
    "district",
  ];
  for (const key of localityKeys) {
    const value = normalized[key]?.trim() || components[key]?.trim();
    if (value) return value;
  }
  return firstComponent(normalized, ["county"]) ||
    firstComponent(components, ["county"]);
};

const uniqueComponents = (parts: string[]): string[] => {
  const seen = new Set<string>();
  return parts.reduce<string[]>((result, part) => {
    const normalized = part.trim().replace(/\s+/g, " ");
    const key = normalized.toLocaleLowerCase("en");
    if (normalized && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
    return result;
  }, []);
};

export const extractAddressComponents = (data: {
  display_name?: string;
  displayName?: string;
  formattedAddress?: string | null;
  addressLine?: string | null;
  city?: string | null;
  town?: string | null;
  municipality?: string | null;
  village?: string | null;
  locality?: string | null;
  hamlet?: string | null;
  borough?: string | null;
  city_district?: string | null;
  state_district?: string | null;
  suburb?: string | null;
  neighbourhood?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  county?: string | null;
  state?: string | null;
  pincode?: string | null;
  postcode?: string | null;
  streetAddress?: string | null;
  address?: ProviderAddressComponents;
}): ReverseGeocodedAddress => {
  const components = data.address ?? {};
  const normalized: ProviderAddressComponents = {
    city: data.city ?? undefined,
    town: data.town ?? undefined,
    municipality: data.municipality ?? undefined,
    village: data.village ?? undefined,
    locality: data.locality ?? undefined,
    hamlet: data.hamlet ?? undefined,
    borough: data.borough ?? undefined,
    city_district: data.city_district ?? undefined,
    state_district: data.state_district ?? undefined,
    suburb: data.suburb ?? undefined,
    neighbourhood: data.neighbourhood ?? undefined,
    neighborhood: data.neighborhood ?? undefined,
    district: data.district ?? undefined,
    county: data.county ?? undefined,
    state: data.state ?? undefined,
    pincode: data.pincode ?? undefined,
    postcode: data.postcode ?? undefined,
  };
  const street = data.addressLine?.trim() || data.streetAddress?.trim() || uniqueComponents([
    firstComponent(components, ["house_number"]),
    firstComponent(components, ["house_name", "building"]),
    firstComponent(components, ["road", "street"]),
    firstComponent(components, ["residential"]),
    firstComponent(components, ["pedestrian"]),
    firstComponent(components, ["footway"]),
    firstComponent(components, ["neighbourhood", "neighborhood"]),
    firstComponent(components, ["suburb"]),
  ]).join(", ");

  // Prefer populated localities over broader administrative regions. County
  // is deliberately last because it can be substantially less specific.
  const city = firstLocality(normalized, components);
  const postcode = firstComponent(normalized, ["pincode", "postcode"]) ||
    firstComponent(components, ["postcode"]);
  return {
    addressLine: street,
    city,
    state: firstComponent(normalized, ["state"]) || firstComponent(components, ["state"]),
    pincode: /^\d{6}$/.test(postcode) ? postcode : "",
    displayName: data.display_name ?? data.displayName ?? data.formattedAddress ?? "",
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
