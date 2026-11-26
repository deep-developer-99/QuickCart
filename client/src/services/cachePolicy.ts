export const PUBLIC_CACHE_TTL_MS = {
  categories: 15 * 60_000,
  banners: 10 * 60_000,
  homepageSections: 60_000,
  products: 60_000,
  searchSuggestions: 5 * 60_000,
  footerSettings: 5 * 60_000,
  theme: 10 * 60_000,
  contactInformation: 5 * 60_000,
} as const;

export const PRIVATE_CACHE_TTL_MS = {
  addresses: 60_000,
  orders: 30_000,
  orderCount: 60_000,
  orderDetails: 30_000,
  notifications: 30_000,
} as const;

export const isCacheFresh = (fulfilledAt: number | undefined, ttlMs: number, now = Date.now()) =>
  fulfilledAt !== undefined && now - fulfilledAt < ttlMs;

const stableValue = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
};

export const createQueryCacheKey = (url: string, params?: unknown, scope?: string) =>
  `${scope ? `${scope}|` : ""}${url}|${stableValue(params ?? {})}`;
