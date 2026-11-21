import crypto from "crypto";

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Jika APP_SECRET tidak diset saat dev lokal, tolak di production
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("WHATSAPP_APP_SECRET is not set in production.");
      return false;
    }
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const actualHash = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expectedHash, "hex");
  const actualBuf = Buffer.from(actualHash, "hex");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}