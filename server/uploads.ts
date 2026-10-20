import type { Request } from "express";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomBytes } from "crypto";
import { cleanImage, UploadError } from "./images";

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Where uploaded files live on disk (served at /uploads). UPLOADS_DIR lets tests use a temporary
// folder instead of the project's uploads/ directory.
export function uploadsDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
}

export function getUploadContentType(req: Request): string {
  return String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
}

export function createUploadFilename(contentType: string): string {
  const extension = ALLOWED_UPLOAD_TYPES[contentType];
  return `${Date.now()}-${randomBytes(12).toString("hex")}.${extension}`;
}

export function isSafeUploadFilename(filename: string, contentType: string): boolean {
  const expectedExtension = ALLOWED_UPLOAD_TYPES[contentType];
  if (!expectedExtension) return false;
  const escapedExtension = expectedExtension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\d+-[a-f0-9]{24}\\.${escapedExtension}$`).test(filename);
}

// Validates, strips metadata from (see cleanImage) and stores an uploaded image. Returns its
// public path. Throws UploadError for problems the uploader can fix.
export async function saveUploadBuffer(buffer: Buffer, contentType: string, requestedFilename?: string): Promise<string> {
  if (!ALLOWED_UPLOAD_TYPES[contentType]) {
    throw new UploadError("Unsupported image type. Use JPG, PNG, WebP, or GIF.");
  }
  if (buffer.length === 0) {
    throw new UploadError("No file data received");
  }
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadError("File is too large. Maximum size is 10MB.");
  }

  const cleaned = await cleanImage(buffer, contentType);

  const uploadDir = uploadsDir();
  await mkdir(uploadDir, { recursive: true });

  const filename = requestedFilename && isSafeUploadFilename(requestedFilename, contentType)
    ? requestedFilename
    : createUploadFilename(contentType);
  await writeFile(path.join(uploadDir, filename), cleaned, { flag: "wx" });

  return `/uploads/${filename}`;
}

// The message to send back for a failed upload: UploadError text, or a generic message for
// anything else (file-system and library errors can contain server paths).
export function uploadErrorMessage(error: unknown): string {
  return error instanceof UploadError ? error.message : "Upload failed. Please try again.";
}
