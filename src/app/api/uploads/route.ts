import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const extensionByMime: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "uploads",
    limit: 20,
    windowMs: 60_000,
    key: `user:${session.user.id}`,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many upload requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!extensionByMime[file.type]) {
    return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 5MB." },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = extensionByMime[file.type];
  const fileName = `${Date.now()}-${randomUUID()}.${ext}`;

  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const outputPath = path.join(uploadDir, fileName);
    await fs.writeFile(outputPath, buffer);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch (error) {
    // Fallback for read-only file systems (common in serverless environments): store in Vercel Blob.
    logApiEvent("warn", "uploads.post.filesystem_write_failed_attempt_blob", {
      userId: session.user.id,
      mimeType: file.type,
      sizeBytes: file.size,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const blob = await put(`uploads/${fileName}`, file, {
        access: "public",
        addRandomSuffix: false,
      });

      return NextResponse.json({ url: blob.url, storage: "blob" });
    } catch (blobError) {
      logApiEvent("error", "uploads.post.blob_fallback_failed", {
        userId: session.user.id,
        mimeType: file.type,
        sizeBytes: file.size,
        error: blobError instanceof Error ? blobError.message : String(blobError),
      });

      return NextResponse.json(
        {
          error:
            "Image upload storage is unavailable. Configure Vercel Blob (BLOB_READ_WRITE_TOKEN) or retry later.",
        },
        { status: 500 },
      );
    }
  }
}
