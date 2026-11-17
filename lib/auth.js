import { timingSafeEqual, createHash } from "crypto";

export function checkPassword(given) {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected || typeof given !== "string") return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
