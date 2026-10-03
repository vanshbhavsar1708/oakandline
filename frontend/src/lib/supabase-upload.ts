import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiJson, ApiError } from "./queryClient";

let storageClient: SupabaseClient | undefined;

export async function apiUpload<T>(url: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  const files = ["images", "image"]
    .flatMap((field) => form.getAll(field))
    .filter((value): value is File => value instanceof File);
  const projectId = url.match(/\/api\/admin\/projects\/(\d+)\/images$/)?.[1];
  if (!files.length) throw new ApiError(400, "Choose an image.");

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new ApiError(500, "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify, then rebuild.");
  }
  storageClient ??= createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const created: unknown[] = [];
  const failed: { file: string; reason: string }[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    try {
      if (!/^image\/(jpeg|png|webp|avif|heic|heif|tiff)$/.test(file.type)) {
        throw new ApiError(400, "Please upload JPG, PNG, WebP, AVIF or HEIC images.");
      }
      const signed = await apiJson<{ path: string; token: string }>("POST", "/api/admin/uploads/sign", {
        contentType: file.type,
      });
      onProgress?.(Math.round((index / files.length) * 90));
      const { error } = await storageClient.storage
        .from("oakline-uploads")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
          cacheControl: "3600",
        });
      if (error) throw new ApiError(400, error.message);
      onProgress?.(Math.round(((index + 0.75) / files.length) * 90));
      created.push(
        await apiJson("POST", "/api/admin/uploads/finalize", {
          path: signed.path,
          ...(projectId ? { projectId: Number(projectId) } : {}),
        }),
      );
      onProgress?.(Math.round(((index + 1) / files.length) * 100));
    } catch (error) {
      if (!projectId) throw error;
      failed.push({ file: file.name, reason: (error as Error).message });
    }
  }

  if (projectId) return { created, failed } as T;
  return created[0] as T;
}
