import { randomUUID } from "crypto";
import path from "path";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { deleteFromR2, getPublicObjectKeyFromUrl, uploadToR2 } from "@/lib/r2/client";
import { getProfile, updateProfileAvatar } from "@/server/services/authService";
import { ServiceError } from "@/server/services/serviceError";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function resolveExtension(file: File): string {
  const extension = path.extname(file.name).toLowerCase();
  if (extension === ".png" || extension === ".jpg" || extension === ".jpeg") {
    return extension === ".jpeg" ? ".jpg" : extension;
  }

  return file.type === "image/png" ? ".png" : ".jpg";
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "INVALID_FORM_DATA", "Request body must be multipart form data.");
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return errorResponse(400, "MISSING_FILE", "file is required.");
  }

  if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
    return errorResponse(400, "INVALID_FILE_TYPE", "Only PNG and JPG files are supported.");
  }

  if (fileEntry.size <= 0 || fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(400, "INVALID_FILE_SIZE", "File size must be between 1 byte and 2 MB.");
  }

  try {
    const profile = await getProfile(auth.session.userId);
    const extension = resolveExtension(fileEntry);
    const objectKey = `user/${profile.id}/avatar-${randomUUID()}${extension}`;
    const body = Buffer.from(await fileEntry.arrayBuffer());
    const url = await uploadToR2({
      objectKey,
      body,
      contentType: fileEntry.type
    });

    const updatedProfile = await updateProfileAvatar(profile.id, url);
    const previousObjectKey = getPublicObjectKeyFromUrl(profile.avatarUrl ?? "");
    if (previousObjectKey) {
      await deleteFromR2(previousObjectKey).catch(() => undefined);
    }

    return NextResponse.json({ data: { user: updatedProfile, url } }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PROFILE_AVATAR_UPLOAD_FAILED", "Failed to upload avatar.");
  }
}
