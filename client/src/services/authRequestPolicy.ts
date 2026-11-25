export interface AuthRequestOwner {
  userId: string | null;
  revision: number;
}

const getApiPath = (url: string | undefined) => {
  if (!url) return "";
  let pathname = url;
  try {
    if (/^https?:\/\//i.test(url)) pathname = new URL(url).pathname;
  } catch {
    return "";
  }
  pathname = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
};

/** Public reads are explicitly enumerated from routes with no auth middleware. */
export const isPublicReadRequest = (method: string | undefined, url: string | undefined) => {
  if (method?.toUpperCase() !== "GET") return false;
  const path = getApiPath(url);
  if ([
    "/categories",
    "/categories/catalog",
    "/products",
    "/products/category",
    "/banners",
    "/promotional-banners",
    "/footer-settings",
    "/homepage-sections",
    "/search-suggestions",
    "/theme/public",
  ].includes(path)) return true;

  return /^\/categories\/[^/]+(?:\/subcategories)?$/.test(path)
    || /^\/products\/category\/[^/]+$/.test(path)
    || /^\/products\/(?!vendor$)[^/]+$/.test(path);
};

export const shouldCancelForAuthChange = (
  owner: AuthRequestOwner | undefined,
  current: AuthRequestOwner,
  method: string | undefined,
  url: string | undefined,
) => {
  if (!owner || isPublicReadRequest(method, url)) return false;
  return owner.userId !== current.userId || owner.revision !== current.revision;
};
