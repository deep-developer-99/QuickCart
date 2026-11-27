import { lookup as dnsLookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import { isIP } from "node:net";

export const MAX_SUBCATEGORY_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const CLOUDINARY_SOURCE_HOST = "res.cloudinary.com";
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export class SubcategoryImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubcategoryImageError";
  }
}

const parseAllowedHosts = () => new Set([
  CLOUDINARY_SOURCE_HOST,
  ...(process.env.SUBCATEGORY_IMAGE_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean),
]);

export const parsePermittedImageUrl = (value: string, allowedHosts = parseAllowedHosts()): URL => {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new SubcategoryImageError("Image URL must be a valid absolute HTTPS URL."); }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) {
    throw new SubcategoryImageError("Image URL must use HTTPS without credentials, fragments, or a nonstandard port.");
  }
  if (!hostname || isIP(hostname) || !allowedHosts.has(hostname)) {
    throw new SubcategoryImageError("Image URL host is not in the permitted image source allowlist.");
  }
  url.hostname = hostname;
  return url;
};

export const isPublicImageAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    const [a, b, c] = octets;
    if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) return false;
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168) ) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      (a === 255 && b === 255 && c === 255)
    );
  }
  if (family === 6) {
    const words = address.split(":");
    const first = Number.parseInt(words[0] || "0", 16);
    const second = Number.parseInt(words[1] || "0", 16);
    // Permit global unicast only; reject mapped, link-local, ULA, multicast and special-use ranges.
    return first >= 0x2000 && first <= 0x3fff &&
      !(first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) &&
      first !== 0x2002 && !(first === 0x3fff && second <= 0x000f);
  }
  return false;
};

const resolvePublicAddress = async (hostname: string) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => !isPublicImageAddress(record.address))) {
    throw new SubcategoryImageError("Image URL resolves to a non-public or unavailable network address.");
  }
  return records[0];
};

export const validateImageSourceUrl = async (value: string): Promise<void> => {
  const url = parsePermittedImageUrl(value);
  await resolvePublicAddress(url.hostname);
};

const readRemoteImage = async (url: URL, redirectsRemaining: number): Promise<Buffer> => {
  const pinnedAddress = await resolvePublicAddress(url.hostname);
  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const lookup: NonNullable<RequestOptions["lookup"]> = (_hostname, _options, callback) => {
      callback(null, pinnedAddress.address, pinnedAddress.family);
    };
    const options: RequestOptions = {
      protocol: "https:",
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: { Accept: "image/jpeg,image/png,image/webp" },
      lookup,
      timeout: IMAGE_TIMEOUT_MS,
    };
    const req = request(options, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = res.headers.location;
        res.resume();
        if (!location || redirectsRemaining <= 0) {
          finishError(new SubcategoryImageError("Image URL redirected too many times or without a valid location."));
          return;
        }
        let nextUrl: URL;
        try { nextUrl = parsePermittedImageUrl(new URL(location, url).toString()); }
        catch (error) { finishError(error as Error); return; }
        void readRemoteImage(nextUrl, redirectsRemaining - 1).then((buffer) => {
          if (settled) return;
          settled = true;
          resolve(buffer);
        }, finishError);
        return;
      }
      if (status !== 200) {
        res.resume();
        finishError(new SubcategoryImageError("Image source returned an unsuccessful response."));
        return;
      }
      const contentType = (res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!SUPPORTED_MIME_TYPES.has(contentType)) {
        res.resume();
        finishError(new SubcategoryImageError("Image source must return a JPG, PNG, or WEBP image."));
        return;
      }
      const contentLength = Number(res.headers["content-length"] || 0);
      if (contentLength > MAX_SUBCATEGORY_IMAGE_BYTES) {
        res.destroy();
        finishError(new SubcategoryImageError("Image exceeds the 5 MB upload limit."));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_SUBCATEGORY_IMAGE_BYTES) {
          res.destroy(new SubcategoryImageError("Image exceeds the 5 MB upload limit."));
          return;
        }
        chunks.push(buffer);
      });
      res.on("end", () => {
        if (settled) return;
        const image = Buffer.concat(chunks);
        if (!isSupportedImageBuffer(image)) {
          finishError(new SubcategoryImageError("Downloaded content is not a supported JPG, PNG, or WEBP image."));
          return;
        }
        settled = true;
        resolve(image);
      });
      res.on("error", (error) => finishError(error instanceof SubcategoryImageError ? error : new SubcategoryImageError("Image download failed.")));
    });
    req.on("timeout", () => req.destroy(new SubcategoryImageError("Image download timed out.")));
    req.on("error", (error) => finishError(error instanceof SubcategoryImageError ? error : new SubcategoryImageError("Image download failed.")));
    req.end();
  });
};

export const isSupportedImageBuffer = (buffer: Buffer): boolean => {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return jpeg || png || webp;
};

export const downloadSubcategoryImage = async (value: string): Promise<Buffer> => {
  const url = parsePermittedImageUrl(value);
  return readRemoteImage(url, MAX_REDIRECTS);
};
