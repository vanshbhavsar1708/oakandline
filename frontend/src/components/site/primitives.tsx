import { useEffect, useRef, type ReactNode, type ElementType, type CSSProperties } from "react";
import { imageSrcSet, imageUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Logo — a growth-ring "O" crossed by a single drawn line.            */
/* ------------------------------------------------------------------ */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="18" cy="20" r="13" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="20" r="7.5" stroke="currentColor" strokeWidth="1" opacity=".55" />
      <path d="M27 4v32" stroke="hsl(var(--gold))" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", tone === "light" ? "text-[hsl(var(--ivory))]" : "text-foreground", className)}
      aria-label="Oak & Line"
    >
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="font-display text-[1.35rem] leading-none tracking-tight">
        Oak <span className="text-gold">&amp;</span> Line
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal — IntersectionObserver based, no animation library needed.   */
/* ------------------------------------------------------------------ */
export function Reveal({
  as: Tag = "div",
  className,
  children,
  delay = 0,
  variant = "reveal",
  style,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  delay?: number;
  variant?: "reveal" | "img-reveal";
  style?: CSSProperties;
  [k: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={cn(variant, className)} style={{ transitionDelay: `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Responsive image — srcset + lazy + async decode + fixed aspect.     */
/* ------------------------------------------------------------------ */
export function Picture({
  base,
  alt,
  sizes = "100vw",
  className,
  imgClassName,
  priority = false,
  width,
  height,
}: {
  base: string;
  alt: string;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  if (!base) return <div className={cn("bg-muted", className)} aria-hidden="true" />;
  return (
    <div className={cn("overflow-hidden bg-[hsl(var(--muted))]", className)}>
      <img
        src={imageUrl(base, 1280)}
        srcSet={imageSrcSet(base)}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // @ts-expect-error fetchpriority is valid HTML
        fetchpriority={priority ? "high" : "auto"}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}

export function SectionLabel({ index, children, light }: { index?: string; children: ReactNode; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-4 eyebrow", light ? "text-[hsl(var(--ivory)/0.7)]" : "text-gold-deep")}>
      {index && <span className="tabular-nums">{index}</span>}
      <span className="h-px w-10 bg-[hsl(var(--gold))]" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
