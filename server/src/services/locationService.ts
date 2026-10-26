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

export interface LocationSearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address: Record<string, string | undefined>;
}

type NominatimValue = NominatimResult | NominatimResult[] | null;

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
  { value: NominatimValue; expiresAt: number }
>();
const IN_FLIGHT = new Map<string, Promise<NominatimValue>>();

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

const remember = (key: string, value: NominatimValue): void => {
  RESULT_CACHE.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (RESULT_CACHE.size > MAX_CACHE_ENTRIES) {
    const oldestKey = RESULT_CACHE.keys().next().value;
    if (oldestKey) RESULT_CACHE.delete(oldestKey);
  }
};

const requestNominatim = async (
  endpoint: "search" | "reverse",
  params: URLSearchParams,
  stage?: string,
  returnAllSearchResults = false,
): Promise<NominatimValue> => {
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
    if (stage) {
      console.warn("[Nominatim] lookup failed", {
        stage,
        providerHttpStatus: null,
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : "network_error",
      });
    }
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new LocationLookupError("TIMEOUT");
    }
    throw new LocationLookupError("PROVIDER_ERROR");
  }

  if (response.status === 429) {
    if (stage) {
      console.warn("[Nominatim] lookup failed", {
        stage,
        providerHttpStatus: response.status,
        error: "rate_limited",
      });
    }
    throw new LocationLookupError("RATE_LIMITED");
  }
  if (!response.ok) {
    if (stage) {
      console.warn("[Nominatim] lookup failed", {
        stage,
        providerHttpStatus: response.status,
        error: "provider_error",
      });
    }
    throw new LocationLookupError("PROVIDER_ERROR");
  }

  try {
    if (endpoint === "search") {
      const results: unknown = await response.json();
      if (!Array.isArray(results)) {
        throw new LocationLookupError("PROVIDER_ERROR");
      }
      if (stage) {
        console.info("[Nominatim] lookup completed", {
          stage,
          providerHttpStatus: response.status,
          resultCount: results.length,
        });
      }
      const candidates = (results as NominatimResult[]).filter(
        (candidate) => toCoordinate(candidate) !== null,
      );
      if (returnAllSearchResults) return candidates;
      const candidate = candidates[0];
      return candidate ?? null;
    }

    const result: unknown = await response.json();
    if (!result || typeof result !== "object") {
      throw new LocationLookupError("PROVIDER_ERROR");
    }
    return result as NominatimResult;
  } catch (error) {
    if (stage) {
      console.warn("[Nominatim] lookup failed", {
        stage,
        providerHttpStatus: response.status,
        resultCount: null,
        error: "invalid_response",
      });
    }
    if (error instanceof LocationLookupError) throw error;
    throw new LocationLookupError("PROVIDER_ERROR");
  }
};

const getCachedOrRequest = async (
  cacheKey: string,
  endpoint: "search" | "reverse",
  params: URLSearchParams,
  stage?: string,
  returnAllSearchResults = false,
): Promise<NominatimValue> => {
  const cached = RESULT_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (stage) {
      console.info("[Nominatim] lookup cache hit", {
        stage,
        resultCount: Array.isArray(cached.value)
          ? cached.value.length
          : cached.value
            ? 1
            : 0,
      });
    }
    return cached.value;
  }
  if (cached) RESULT_CACHE.delete(cacheKey);

  const inFlight = IN_FLIGHT.get(cacheKey);
  if (inFlight) return inFlight;

  const request = requestNominatim(
    endpoint,
    params,
    stage,
    returnAllSearchResults,
  )
    .then((value) => {
      remember(cacheKey, value);
      return value;
    })
    .finally(() => IN_FLIGHT.delete(cacheKey));
  IN_FLIGHT.set(cacheKey, request);
  return request;
};

interface ForwardAddress {
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

const normalizePart = (value: unknown, maxLength = 120): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new LocationLookupError("INVALID_INPUT");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maxLength) {
    throw new LocationLookupError("INVALID_INPUT");
  }
  return normalized;
};

export const normalizeAddressQuery = (value: unknown): ForwardAddress => {
  if (typeof value === "string") {
    const address = normalizePart(value, 500);
    if (!address || address.length < 5) {
      throw new LocationLookupError("INVALID_INPUT");
    }
    return { address, country: "India" };
  }
  if (!value || typeof value !== "object") {
    throw new LocationLookupError("INVALID_INPUT");
  }
  const input = value as Record<string, unknown>;
  const address = normalizePart(input.address, 500);
  if (!address || address.length < 5) {
    throw new LocationLookupError("INVALID_INPUT");
  }
  const city = normalizePart(input.city);
  const state = normalizePart(input.state);
  const pincode = normalizePart(input.pincode, 20);
  const country = normalizePart(input.country) ?? "India";
  return { address, city, state, pincode, country };
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
  const fullQuery = [
    address.address,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter((part): part is string => Boolean(part))
    .filter(
      (part, index, parts) =>
        parts.findIndex(
          (candidate) => candidate.toLocaleLowerCase("en-IN") === part.toLocaleLowerCase("en-IN"),
        ) === index,
    )
    .join(", ");

  const search = async (
    query: string,
    stage: "full-address" | "locality-fallback",
  ): Promise<NominatimResult | null> => {
    const cacheKey = `forward:${query.toLocaleLowerCase("en-IN")}`;
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
    });
    const result = await getCachedOrRequest(cacheKey, "search", params, stage);
    if (Array.isArray(result)) throw new LocationLookupError("PROVIDER_ERROR");
    return result;
  };

  const fullResult = await search(fullQuery, "full-address");
  if (fullResult) {
    if (Array.isArray(fullResult)) {
      throw new LocationLookupError("PROVIDER_ERROR");
    }
    const coordinate = toCoordinate(fullResult);
    if (!coordinate) throw new LocationLookupError("PROVIDER_ERROR");
    return { coordinate, displayName: fullResult.display_name ?? null };
  }

  const addressParts = address.address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const pincodeInAddress = address.address.match(/\b\d{6}\b/)?.[0];
  const hasStructuredContext = Boolean(
    (address.city && address.state) ||
      (address.state && address.pincode) ||
      (pincodeInAddress && addressParts.length >= 3),
  );
  const fallbackParts = address.city && address.state
    ? [address.city, address.state, address.pincode, address.country]
    : address.state && address.pincode
      ? [address.state, address.pincode, address.country]
      : hasStructuredContext
        ? [...addressParts.slice(1), address.country]
        : [];
  const fallbackQuery = fallbackParts
    .filter((part): part is string => Boolean(part))
    .filter(
      (part, index, parts) =>
        parts.findIndex(
          (candidate) => candidate.toLocaleLowerCase("en-IN") === part.toLocaleLowerCase("en-IN"),
        ) === index,
    )
    .join(", ");

  if (!fallbackQuery || fallbackQuery.toLocaleLowerCase("en-IN") === fullQuery.toLocaleLowerCase("en-IN")) {
    console.info("[Nominatim] locality fallback skipped", {
      stage: "locality-fallback",
      providerHttpStatus: null,
      resultCount: 0,
      reason: "insufficient_location_context",
    });
    throw new LocationLookupError("NOT_FOUND");
  }

  const fallbackResult = await search(fallbackQuery, "locality-fallback");
  if (!fallbackResult) throw new LocationLookupError("NOT_FOUND");
  const coordinate = toCoordinate(fallbackResult);
  if (!coordinate) throw new LocationLookupError("PROVIDER_ERROR");
  return { coordinate, displayName: fallbackResult.display_name ?? null };
};

export const searchLocations = async (
  value: unknown,
): Promise<LocationSearchResult[]> => {
  if (typeof value !== "string") throw new LocationLookupError("INVALID_INPUT");
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 200) {
    throw new LocationLookupError("INVALID_INPUT");
  }
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  });
  const rawResults = await getCachedOrRequest(
    `search:${query.toLocaleLowerCase("en-IN")}`,
    "search",
    params,
    "place-search",
    true,
  );
  if (!Array.isArray(rawResults)) {
    if (rawResults === null) return [];
    throw new LocationLookupError("PROVIDER_ERROR");
  }
  return rawResults.flatMap((result) => {
    const coordinate = toCoordinate(result);
    if (!coordinate || !result.display_name) return [];
    return [{
      ...coordinate,
      displayName: result.display_name,
      address: result.address ?? {},
    }];
  });
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
  if (Array.isArray(result)) throw new LocationLookupError("PROVIDER_ERROR");
  return result;
};
