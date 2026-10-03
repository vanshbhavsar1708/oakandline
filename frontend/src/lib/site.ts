import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Category, ProjectWithImages, Service, SiteContent } from "@shared/schema";

export type PublicCity = { id: number; name: string; slug: string; state: string };
export type SitePayload = { content: SiteContent; services: Service[]; categories: Category[]; cities: PublicCity[] };

export function useSite() {
  return useQuery<SitePayload>({ queryKey: ["/api/site"], staleTime: 5 * 60_000 });
}

export function useProjects(params?: { category?: string; featured?: boolean }) {
  const q: Record<string, string> = {};
  if (params?.category && params.category !== "all") q.category = params.category;
  if (params?.featured) q.featured = "1";
  return useQuery<ProjectWithImages[]>({ queryKey: ["/api/projects", q] });
}

export function coverOf(p: ProjectWithImages) {
  return p.images.find((i) => i.isCover) ?? p.images[0];
}

export function localHref(path: string) {
  const value = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.VITE_ROUTER === "browser") return value;
  return value === "/" ? "#/" : `#${value}`;
}

/** Lightweight per-page SEO without a head-manager dependency. */
export function useSeo({ title, description, image }: { title: string; description?: string; image?: string }) {
  useEffect(() => {
    const full = title.includes("Oak & Line") ? title : `${title} | Oak & Line`;
    document.title = full;
    const set = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [k, v] = selector.replace(/^meta\[|\]$/g, "").split("=");
        el.setAttribute(k, v.replace(/"/g, ""));
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };
    set('meta[property="og:title"]', "content", full);
    if (description) {
      set('meta[name="description"]', "content", description);
      set('meta[property="og:description"]', "content", description);
    }
    if (image) set('meta[property="og:image"]', "content", image);
  }, [title, description, image]);
}
