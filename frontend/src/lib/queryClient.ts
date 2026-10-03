import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * API base:
 *  - VITE_API_URL  → explicit API origin (e.g. client-owned API host behind Netlify)
 *  - __PORT_5000__ → rewritten by the preview proxy
 *  - ""            → same-origin (/api/...)
 */
const ENV_API = (import.meta.env.VITE_API_URL as string | undefined) || "";
export const API_BASE = ENV_API || ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__");

/** Admin token lives in memory only (never persisted to storage, never bundled). */
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText || "Something went wrong";
    let fieldErrors: Record<string, string> | undefined;
    try {
      const body = await res.json();
      message = body.message || message;
      fieldErrors = body.fieldErrors;
    } catch {
      /* non-JSON */
    }
    if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, message, fieldErrors);
  }
}

function headers(json: boolean): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: headers(data !== undefined),
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

export async function apiJson<T>(method: string, url: string, data?: unknown): Promise<T> {
  const res = await apiRequest(method, url, data);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload with progress (XHR so we can report % to the admin). */
function legacyApiUpload<T>(url: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${url}`);
    if (authToken) xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else {
        if (xhr.status === 401 && onUnauthorized) onUnauthorized();
        reject(new ApiError(xhr.status, body.message || "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error — check your connection and try again."));
    xhr.send(form);
  });
}

/** Resolve an image base path into a URL for a given width. */
/** Resolve a bundled public file ("./images/x") against the app base so it works on nested routes. */
export function asset(p: string) {
  return p.startsWith("./") ? `${import.meta.env.BASE_URL}${p.slice(2)}` : p;
}
export function imageUrl(basePath: string, width: 640 | 1280 | 2000 = 1280) {
  if (!basePath) return "";
  if (/^https?:\/\//i.test(basePath)) return `${basePath}-${width}.webp`;
  if (basePath.startsWith("/uploads/")) return `${API_BASE}${basePath}-${width}.webp`;
  return `${asset(basePath)}-${width}.webp`;
}
export function imageSrcSet(basePath: string) {
  return ([640, 1280, 2000] as const).map((w) => `${imageUrl(basePath, w)} ${w}w`).join(", ");
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const [path, params] = queryKey as [string, Record<string, string> | undefined];
    const qs = params && typeof params === "object" ? "?" + new URLSearchParams(params).toString() : "";
    const res = await fetch(`${API_BASE}${path}${qs}`, { headers: headers(false) });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});
