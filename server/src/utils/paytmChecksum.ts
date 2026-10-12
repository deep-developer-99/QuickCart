import crypto from "crypto";

/**
 * Paytm checksum implementation for the documented SHA-256 + AES-128-CBC
 * checksum format. Keep this server-side only; never expose the merchant key.
 * API requests/responses sign the JSON body string, not the outer { head, body }
 * envelope. See Paytm's official Node checksum documentation.
 */
const IV = "@@@@&&&&####$$$$";

const calculateHash = (body: string, salt: string): string =>
  `${crypto.createHash("sha256").update(`${body}|${salt}`).digest("hex")}${salt}`;

const encrypt = (plainText: string, key: string): string => {
  if (Buffer.byteLength(key, "utf8") !== 16) {
    throw new Error(
      "PAYTM_MERCHANT_KEY must be the 16-byte merchant key issued by Paytm",
    );
  }
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(IV, "utf8"),
  );
  return Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]).toString("base64");
};

const decrypt = (checksum: string, key: string): string => {
  if (Buffer.byteLength(key, "utf8") !== 16) {
    throw new Error(
      "PAYTM_MERCHANT_KEY must be the 16-byte merchant key issued by Paytm",
    );
  }
  const decipher = crypto.createDecipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(IV, "utf8"),
  );
  return Buffer.concat([
    decipher.update(Buffer.from(checksum, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

export const generatePaytmSignature = (body: string, key: string): string => {
  const salt = crypto.randomBytes(3).toString("base64");
  return encrypt(calculateHash(body, salt), key);
};

export const verifyPaytmSignature = (
  body: string,
  key: string,
  signature: string,
): boolean => {
  try {
    const decrypted = decrypt(signature, key);
    const salt = decrypted.slice(-4);
    if (salt.length !== 4) return false;
    const expected = calculateHash(body, salt);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(decrypted, "utf8");
    return (
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  } catch {
    return false;
  }
};

/** Paytm callback payloads may be NVP fields with CHECKSUMHASH. */
export const verifyPaytmParameterSignature = (
  parameters: Record<string, unknown>,
  key: string,
  signature: string,
): boolean => {
  const normalized: Record<string, string> = {};
  for (const field of Object.keys(parameters)
    .filter((name) => name !== "CHECKSUMHASH")
    .sort()) {
    const value = parameters[field];
    normalized[field] =
      value === undefined || value === null ? "" : String(value);
  }
  return verifyPaytmSignature(
    Object.values(normalized).join("|"),
    key,
    signature,
  );
};
