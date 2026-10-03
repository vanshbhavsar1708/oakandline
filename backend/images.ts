import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

/**
 * Image pipeline: every upload is validated by decoding it (not by trusting the
 * extension/MIME), auto-rotated, stripped of metadata and stored as WebP in three
 * responsive widths:  <base>-640.webp, <base>-1280.webp, <base>-2000.webp
 *
 * UPLOAD_DIR can point to a client-owned persistent disk. To move to object storage
 * (S3 / Cloudinary / Netlify Blobs) replace `writeVariant` — callers only use basePath.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "data", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const IMAGE_WIDTHS = [640, 1280, 2000] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB per file
export const MAX_FILES_PER_REQUEST = 20;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff"]);

export class ImageValidationError extends Error {
  status = 400;
}

export async function processImage(buffer: Buffer): Promise<{ basePath: string; width: number; height: number }> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new ImageValidationError("That file isn't a readable image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new ImageValidationError("Please upload JPG, PNG, WebP or HEIC images.");
  }
  if (!meta.width || !meta.height || meta.width < 400 || meta.height < 300) {
    throw new ImageValidationError("Image is too small — use at least 400 × 300 px.");
  }

  const id = crypto.randomBytes(9).toString("base64url");
  const base = `/uploads/${id}`;
  let finalW = 0;
  let finalH = 0;

  for (const w of IMAGE_WIDTHS) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: w >= 2000 ? 78 : 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, `${id}-${w}.webp`), out.data);
    if (w === IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]) {
      finalW = out.info.width;
      finalH = out.info.height;
    }
  }
  return { basePath: base, width: finalW, height: finalH };
}

export function deleteImageFiles(basePath: string) {
  if (!basePath.startsWith("/uploads/")) return;
  const id = path.basename(basePath);
  for (const w of IMAGE_WIDTHS) {
    const f = path.join(UPLOAD_DIR, `${id}-${w}.webp`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
