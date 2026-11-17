import { list, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { checkPassword } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function denied() {
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}

export async function GET(request) {
  if (!checkPassword(request.headers.get("x-password"))) return denied();
  const blobs = [];
  let cursor;
  do {
    const page = await list({ cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return NextResponse.json({
    files: blobs.map((b) => ({
      url: b.url,
      downloadUrl: b.downloadUrl,
      pathname: b.pathname,
      size: b.size,
      uploadedAt: b.uploadedAt,
    })),
  });
}

export async function DELETE(request) {
  if (!checkPassword(request.headers.get("x-password"))) return denied();
  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  await del(url);
  return NextResponse.json({ ok: true });
}
