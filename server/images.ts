import sharp from "sharp";

// An upload problem whose message is safe to show the uploader. Anything else that goes wrong
// during an upload is logged and reported as a generic failure, so file-system paths and
// library errors don't reach the client.
export class UploadError extends Error {}

export const IMAGE_FORMAT_FOR_TYPE: Record<string, "jpeg" | "png" | "webp" | "gif"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const JPEG_QUALITY = 85;

// Decodes and re-encodes an uploaded image so only its pixels survive. Phone photos carry EXIF
// metadata (GPS position, time, device) that would otherwise be published with the photo; OWASP's
// file-upload guidance is to re-encode and drop metadata. Re-encoding also rejects files whose
// contents aren't the image type they claim to be.
export async function cleanImage(buffer: Buffer, contentType: string): Promise<Buffer> {
  const format = IMAGE_FORMAT_FOR_TYPE[contentType];
  if (!format) {
    throw new UploadError("Unsupported image type. Use JPG, PNG, WebP, or GIF.");
  }

  let detected: string | undefined;
  try {
    detected = (await sharp(buffer).metadata()).format;
  } catch {
    throw new UploadError("That file isn't a readable image.");
  }
  if (detected !== format) {
    throw new UploadError("The file's contents don't match its image type.");
  }

  if (format === "gif") {
    return sharp(buffer, { animated: true }).gif().toBuffer();
  }

  // rotate() with no angle turns the pixels upright using the EXIF orientation tag. Without it,
  // dropping the metadata would leave portrait phone photos lying on their side.
  const upright = sharp(buffer).rotate();
  if (format === "jpeg") return upright.jpeg({ quality: JPEG_QUALITY }).toBuffer();
  if (format === "png") return upright.png().toBuffer();
  return upright.webp().toBuffer();
}
