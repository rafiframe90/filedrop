import { NextResponse } from "next/server";
import { COOKIE, hasValidCookie, isOpenWindow, newAccessToken, setAccessCookie } from "../../../lib/auth";

export const dynamic = "force-dynamic";

// Tells the page whether this browser is remembered (no password, no lock).
export async function GET(request) {
  if (hasValidCookie(request)) {
    const res = NextResponse.json({ remembered: true });
    // re-set the same cookie so it never runs out while the person keeps using the site
    setAccessCookie(res, request.cookies.get(COOKIE).value);
    return res;
  }
  if (isOpenWindow()) {
    const res = NextResponse.json({ remembered: true });
    setAccessCookie(res, newAccessToken());
    return res;
  }
  return NextResponse.json({ remembered: false });
}
