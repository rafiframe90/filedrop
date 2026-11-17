import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { checkPassword } from "../../../lib/auth";

export async function POST(request) {
  const body = await request.json();
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!checkPassword(clientPayload)) throw new Error("Wrong password");
        return {
          // no allowedContentTypes => every file type is accepted
          addRandomSuffix: true,
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024, // 5 GB per file
          validUntil: Date.now() + 6 * 60 * 60 * 1000, // long uploads OK
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
