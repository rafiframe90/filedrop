// Plain-HTML version of the site for old browsers (Kindle, e-readers, etc.).
// No JavaScript: just links and an ordinary form.
import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  COOKIE, checkPassword, hasValidCookie, isOpenWindow, newAccessToken, setAccessCookie,
} from "../../lib/auth";

export const dynamic = "force-dynamic";

const MAX_LITE_UPLOAD = 4 * 1024 * 1024; // Vercel caps server uploads at ~4.5 MB

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtSize(n) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (n < 10 && i ? n.toFixed(1) : Math.round(n)) + " " + u[i];
}
function displayName(p) {
  return p.replace(/-[A-Za-z0-9]{20,40}(?=\.[^.]+$|$)/, "");
}

function page(body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>drop.</title>
<style>
body{font-family:Georgia,serif;font-size:20px;line-height:1.5;margin:0;padding:16px;color:#000;background:#fff}
h1{font-size:30px;margin:0 0 12px}
a{color:#000}
ul{list-style:none;padding:0;margin:0}
li{border-bottom:1px solid #000;padding:12px 0}
li a{font-weight:bold;word-break:break-all}
.small{font-size:16px}
.box{border:2px solid #000;padding:12px;margin:14px 0}
input,button{font-size:20px}
button{padding:8px 16px;border:2px solid #000;background:#fff}
.msg{border:2px solid #000;padding:8px;margin:10px 0}
</style></head><body>${body}</body></html>`;
}

function html(body, status = 200) {
  return new NextResponse(page(body), { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function redirect(request, query) {
  return NextResponse.redirect(new URL("/lite" + (query || ""), request.url), 303);
}

function authorized(request) {
  return hasValidCookie(request) || isOpenWindow();
}

function passwordForm(msg) {
  return html(`<h1>drop.</h1>${msg ? `<p class="msg">${esc(msg)}</p>` : ""}
<form method="post" action="/lite" class="box">
<p>Enter the password:</p>
<p><input type="password" name="password"></p>
<p><button type="submit">Open</button></p>
</form>`, msg ? 401 : 200);
}

export async function GET(request) {
  if (!authorized(request)) return passwordForm();

  const blobs = [];
  let cursor;
  do {
    const r = await list({ cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  const q = new URL(request.url).searchParams;
  const msg = q.get("ok") ? "Uploaded." : q.get("err") ? q.get("err") : "";

  const items = blobs.length
    ? blobs.map((b) => `<li><a href="${esc(b.downloadUrl || b.url)}">${esc(displayName(b.pathname))}</a><br>
<span class="small">${fmtSize(b.size)} · ${new Date(b.uploadedAt).toISOString().slice(0, 10)}</span></li>`).join("")
    : "<li>No files yet.</li>";

  const res = html(`<h1>drop.</h1>${msg ? `<p class="msg">${esc(msg)}</p>` : ""}
<p class="small"><a href="/lite">Refresh</a></p>
<ul>${items}</ul>
<form method="post" action="/lite" enctype="multipart/form-data" class="box">
<p>Upload a file (up to 4 MB from this page):</p>
<p><input type="file" name="file"></p>
<p><button type="submit">Upload</button></p>
</form>`);
  const existing = request.cookies.get(COOKIE)?.value;
  setAccessCookie(res, hasValidCookie(request) ? existing : newAccessToken());
  return res;
}

export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return redirect(request, "?err=" + encodeURIComponent("File too big for this page (4 MB max).")); }

  const password = form.get("password");
  if (typeof password === "string") {
    if (!checkPassword(password)) return passwordForm("That password isn't right.");
    const res = redirect(request);
    setAccessCookie(res, newAccessToken());
    return res;
  }

  if (!authorized(request)) return passwordForm();

  const file = form.get("file");
  if (!file || typeof file === "string" || !file.size) return redirect(request, "?err=" + encodeURIComponent("Choose a file first."));
  if (file.size > MAX_LITE_UPLOAD) return redirect(request, "?err=" + encodeURIComponent("File too big for this page (4 MB max)."));

  const name = (file.name || "file").replace(/[^\w.\- ()]+/g, "_");
  await put(name, file, { access: "public", addRandomSuffix: true });
  return redirect(request, "?ok=1");
}
