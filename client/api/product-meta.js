const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const MAX_DESCRIPTION_LENGTH = 200;
const API_TIMEOUT_MS = 5000;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeDescription(value) {
  const readable = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (readable.length <= MAX_DESCRIPTION_LENGTH) return readable;
  return `${readable.slice(0, MAX_DESCRIPTION_LENGTH - 3).trimEnd()}...`;
}

function trustedHttpsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function trustedHttpsBaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.search || url.hash) return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function publicImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.includes(":") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function htmlPage({ title, description, canonical, image, status, productName }) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const safeCanonical = canonical ? escapeHtml(canonical) : "";
  const safeImage = image ? escapeHtml(image) : "";
  const productHeading = productName ? escapeHtml(productName) : escapedTitle;
  const imageMeta = image
    ? `<meta property="og:image" content="${safeImage}"><meta name="twitter:image" content="${safeImage}">`
    : "";
  const canonicalMeta = canonical
    ? `<link rel="canonical" href="${safeCanonical}"><meta property="og:url" content="${safeCanonical}">`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle}</title><meta name="description" content="${escapedDescription}">
<meta property="og:type" content="product"><meta property="og:title" content="${escapedTitle}">
<meta property="og:description" content="${escapedDescription}">${imageMeta}${canonicalMeta}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapedTitle}">
<meta name="twitter:description" content="${escapedDescription}">
</head><body><main><h1>${productHeading}</h1><p>${escapedDescription}</p>${safeCanonical ? `<p><a href="${safeCanonical}">View this product on QuickCart</a></p>` : ""}</main></body></html>`;
}

function respondHtml(res, status, body, cacheControl = "no-store") {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.send(body);
}

export default async function handler(req, res) {
  const id = typeof req.query?.id === "string" ? req.query.id : "";
  if (!OBJECT_ID_PATTERN.test(id)) {
    return respondHtml(
      res,
      400,
      htmlPage({
        title: "Product unavailable | QuickCart",
        description: "This product link is invalid or unavailable.",
        status: 400,
      }),
    );
  }

  const siteOrigin = trustedHttpsOrigin(process.env.SITE_URL);
  const apiBase = trustedHttpsBaseUrl(process.env.PRODUCT_API_BASE_URL);
  if (!siteOrigin || !apiBase) {
    return respondHtml(
      res,
      503,
      htmlPage({
        title: "Product preview unavailable | QuickCart",
        description: "Please open this product link in QuickCart.",
        status: 503,
      }),
    );
  }

  const canonical = `${siteOrigin}/products/${id}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBase}/products/${id}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return respondHtml(
        res,
        404,
        htmlPage({
          title: "Product unavailable | QuickCart",
          description: "This product is no longer available.",
          canonical,
          status: 404,
        }),
      );
    }

    if (!response.ok) throw new Error("Product API unavailable");
    const payload = await response.json();
    const product = payload?.success === true ? payload.data : null;
    if (!product || product.isActive === false || typeof product.name !== "string") {
      return respondHtml(
        res,
        404,
        htmlPage({
          title: "Product unavailable | QuickCart",
          description: "This product is no longer available.",
          canonical,
          status: 404,
        }),
      );
    }

    const name = product.name.trim() || "QuickCart product";
    const description = safeDescription(product.description) || `View ${name} on QuickCart.`;
    const image = publicImageUrl(product.image);
    return respondHtml(
      res,
      200,
      htmlPage({
        title: name,
        description,
        canonical,
        image,
        productName: name,
        status: 200,
      }),
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    );
  } catch {
    return respondHtml(
      res,
      503,
      htmlPage({
        title: "Product preview unavailable | QuickCart",
        description: "Please open this product link in QuickCart.",
        canonical,
        status: 503,
      }),
    );
  } finally {
    clearTimeout(timeout);
  }
}
