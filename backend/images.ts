import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { getSupabase } from "./supabase";

/**
 * Image pipeline: every upload is validated by decoding it (not by trusting the
 * extension/MIME), auto-rotated, stripped of metadata and stored as WebP in three
 * responsive widths:  <base>-640.webp, <base>-1280.webp, <base>-2000.webp
 *
 * Uploaded variants use Supabase Storage in production and the local disk in development.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "data", "uploads");

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
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const base = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/oakline-uploads/${id}`
    : `/uploads/${id}`;
  let finalW = 0;
  let finalH = 0;

  for (const w of IMAGE_WIDTHS) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: w >= 2000 ? 78 : 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (supabaseUrl) {
      const { error } = await getSupabase()
        .storage.from("oakline-uploads")
        .upload(`${id}-${w}.webp`, out.data, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (error) throw new Error(`Could not save uploaded image: ${error.message}`);
    } else {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, `${id}-${w}.webp`), out.data);
    }
    if (w === IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]) {
      finalW = out.info.width;
      finalH = out.info.height;
    }
  }
  return { basePath: base, width: finalW, height: finalH };
}

export async function deleteImageFiles(basePath: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const prefix = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/oakline-uploads/` : "";
  const id = prefix && basePath.startsWith(prefix)
    ? path.basename(basePath.slice(prefix.length))
    : basePath.startsWith("/uploads/")
      ? path.basename(basePath)
      : "";
  if (!id) return;
  if (prefix) {
    const { error } = await getSupabase()
      .storage.from("oakline-uploads")
      .remove(IMAGE_WIDTHS.map((width) => `${id}-${width}.webp`));
    if (error) throw new Error(`Could not delete stored image: ${error.message}`);
    return;
  }
  for (const w of IMAGE_WIDTHS) {
    const f = path.join(UPLOAD_DIR, `${id}-${w}.webp`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
