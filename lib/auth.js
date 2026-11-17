import { timingSafeEqual, createHash, createHmac, randomBytes } from "crypto";

// Until this moment, anyone who opens the site gets in without a password,
// and their browser is remembered forever. Override with the OPEN_UNTIL env var.
const DEFAULT_OPEN_UNTIL = "2026-11-20T22:40:00+02:00"; // Fri 20 Nov 2026, 22:40 Israel time

export const COOKIE = "drop_access";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // browsers cap cookies at 400 days; we refresh on every visit

function secret() {
  return process.env.UPLOAD_PASSWORD || process.env.BLOB_READ_WRITE_TOKEN || "";
}

function sha(s) {
  return createHash("sha256").update(s).digest();
}

export function checkPassword(given) {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected || typeof given !== "string") return false;
  return timingSafeEqual(sha(given), sha(expected));
}

export function isOpenWindow() {
  const until = new Date(process.env.OPEN_UNTIL || DEFAULT_OPEN_UNTIL);
  return Date.now() < until.getTime();
}

function sign(id) {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

export function newAccessToken() {
  const id = randomBytes(16).toString("base64url");
  return `${id}.${sign(id)}`;
}

export function hasValidCookie(request) {
  const value = request.cookies?.get?.(COOKIE)?.value;
  if (!value || !secret()) return false;
  const [id, sig] = value.split(".");
  if (!id || !sig) return false;
  return timingSafeEqual(sha(sig), sha(sign(id)));
}

export function setAccessCookie(response, token) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

// Allowed if: remembered browser, or still inside the open window, or correct password.
export function isAuthorized(request, password) {
  return hasValidCookie(request) || isOpenWindow() || checkPassword(password);
}
