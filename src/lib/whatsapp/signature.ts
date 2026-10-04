import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifica la firma X-Hub-Signature-256 que Meta añade a cada webhook. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
