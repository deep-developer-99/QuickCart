import { Request, Response } from "express";

interface NominatimResult {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

// Small in-memory cache avoids repeating public geocoder requests for the same
// rounded coordinates. For multi-instance production deployments, use a shared cache.
const geocodeCache = new Map<
  string,
  { value: NominatimResult; expiresAt: number }
>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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
    const waitMs = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastNominatimRequestAt = Date.now();
  } finally {
    release();
  }
};

export const reverseGeocodeController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    res.status(400).json({
      success: false,
      message: "Valid lat and lon query parameters are required.",
    });
    return;
  }

  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ success: true, data: cached.value, cached: true });
    return;
  }

  try {
    await waitForNominatimSlot();
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "18",
      addressdetails: "1",
    });
    const contact = process.env.NOMINATIM_CONTACT_EMAIL;
    const userAgent = contact
      ? `QuickCartBackend/1.0 (contact: ${contact})`
      : "QuickCartBackend/1.0 (QuickCart mobile location lookup)";

    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
          "User-Agent": userAgent,
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!upstream.ok) {
      const details = (await upstream.text().catch(() => "")).slice(0, 200);
      console.error(`Nominatim returned ${upstream.status}: ${details}`);
      res.status(502).json({
        success: false,
        message: `Address provider returned status ${upstream.status}. Please try again later.`,
      });
      return;
    }

    const result = (await upstream.json()) as NominatimResult;
    geocodeCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    // Bound memory use in this simple process-local cache.
    if (geocodeCache.size > 1000) {
      const oldestKey = geocodeCache.keys().next().value;
      if (oldestKey) geocodeCache.delete(oldestKey);
    }

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    console.error("Reverse geocoding request failed:", error);
    res.status(502).json({
      success: false,
      message: "Unable to look up the address right now.",
    });
  }
};
