export interface GeocodedCoordinate {
  latitude: number;
  longitude: number;
}

export interface NominatimResult {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

export type LocationLookupErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_ERROR";

export class LocationLookupError extends Error {
  constructor(public readonly code: LocationLookupErrorCode) {
    super(code);
    this.name = "LocationLookupError";
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;
const RESULT_CACHE = new Map<
  string,
  { value: NominatimResult | null; expiresAt: number }
>();
const IN_FLIGHT = new Map<string, Promise<NominatimResult | null>>();

let lastNominatimRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

const waitForNominatimSlot = async (): Promise<void> => {
  let release!: () => void;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const waitMs = Math.max(
      0,
      MIN_REQUEST_INTERVAL_MS - (Date.now() - lastNominatimRequestAt),
    );
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastNominatimRequestAt = Date.now();
  } finally {
    release();
  }
};

const remember = (key: string, value: NominatimResult | null): void => {
  RESULT_CACHE.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (RESULT_CACHE.size > MAX_CACHE_ENTRIES) {
    const oldestKey = RESULT_CACHE.keys().next().value;
    if (oldestKey) RESULT_CACHE.delete(oldestKey);
  }
};

const requestNominatim = async (
  endpoint: "search" | "reverse",
  params: URLSearchParams,
): Promise<NominatimResult | null> => {
  await waitForNominatimSlot();
  const contact = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
  const userAgent = contact
    ? `QuickCartBackend/1.0 (${contact})`
    : "QuickCartBackend/1.0 (QuickCart location lookup)";

  let response: Response;
  try {
    response = await fetch(
      `https://nominatim.openstreetmap.org/${endpoint}?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
          "User-Agent": userAgent,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new LocationLookupError("TIMEOUT");
    }
    throw new LocationLookupError("PROVIDER_ERROR");
  }

  if (response.status === 429) {
    throw new LocationLookupError("RATE_LIMITED");
  }
  if (!response.ok) throw new LocationLookupError("PROVIDER_ERROR");

  try {
    if (endpoint === "search") {
      const results: unknown = await response.json();
      if (!Array.isArray(results)) {
        throw new LocationLookupError("PROVIDER_ERROR");
      }
      const candidate = results[0] as NominatimResult | undefined;
      if (!candidate) return null;
      const coordinate = toCoordinate(candidate);
      if (!coordinate) throw new LocationLookupError("PROVIDER_ERROR");
      return candidate;
    }

    const result: unknown = await response.json();
    if (!result || typeof result !== "object") {
      throw new LocationLookupError("PROVIDER_ERROR");
    }
    return result as NominatimResult;
  } catch (error) {
    if (error instanceof LocationLookupError) throw error;
    throw new LocationLookupError("PROVIDER_ERROR");
  }
};

const getCachedOrRequest = async (
  cacheKey: string,
  endpoint: "search" | "reverse",
  params: URLSearchParams,
): Promise<NominatimResult | null> => {
  const cached = RESULT_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) RESULT_CACHE.delete(cacheKey);

  const inFlight = IN_FLIGHT.get(cacheKey);
  if (inFlight) return inFlight;

  const request = requestNominatim(endpoint, params)
    .then((value) => {
      remember(cacheKey, value);
      return value;
    })
    .finally(() => IN_FLIGHT.delete(cacheKey));
  IN_FLIGHT.set(cacheKey, request);
  return request;
};

export const normalizeAddressQuery = (value: unknown): string => {
  if (typeof value !== "string") throw new LocationLookupError("INVALID_INPUT");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 5 || normalized.length > 500) {
    throw new LocationLookupError("INVALID_INPUT");
  }
  return normalized;
};

export const toCoordinate = (
  result: NominatimResult,
): GeocodedCoordinate | null => {
  if (
    typeof result.lat !== "string" ||
    !result.lat.trim() ||
    typeof result.lon !== "string" ||
    !result.lon.trim()
  ) {
    return null;
  }
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
};

export const forwardGeocodeAddress = async (
  input: unknown,
): Promise<{ coordinate: GeocodedCoordinate; displayName: string | null }> => {
  const address = normalizeAddressQuery(input);
  const cacheKey = `forward:${address.toLocaleLowerCase("en-IN")}`;
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
  });
  const result = await getCachedOrRequest(cacheKey, "search", params);
  if (!result) throw new LocationLookupError("NOT_FOUND");
  const coordinate = toCoordinate(result);
  if (!coordinate) throw new LocationLookupError("PROVIDER_ERROR");
  return { coordinate, displayName: result.display_name ?? null };
};

export const reverseGeocodeCoordinates = async (
  latitude: number,
  longitude: number,
): Promise<NominatimResult> => {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new LocationLookupError("INVALID_INPUT");
  }
  const cacheKey = `reverse:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
  });
  const result = await getCachedOrRequest(cacheKey, "reverse", params);
  if (!result) throw new LocationLookupError("NOT_FOUND");
  return result;
};
