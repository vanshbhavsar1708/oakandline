import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProjectImage } from "@shared/schema";
import { imageSrcSet, imageUrl } from "@/lib/queryClient";

/** Accessible lightbox: focus trap-lite, Esc / arrows, swipe on touch. */
export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
  title,
}: {
  images: ProjectImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  title: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const count = images.length;
  const prev = useCallback(() => onIndex((index - 1 + count) % count), [index, count, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % count), [index, count, onIndex]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prevFocus?.focus();
    };
  }, [onClose, prev, next]);

  const img = images[index];
  if (!img) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — image ${index + 1} of ${count}`}
      className="fixed inset-0 z-[80] bg-[hsl(var(--ink)/0.97)] text-ivory flex flex-col page-in"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
        touchX.current = null;
      }}
      data-testid="dialog-lightbox"
    >
      <div className="flex items-center justify-between px-5 md:px-8 h-16 shrink-0">
        <span className="eyebrow text-[hsl(var(--ivory)/0.7)] tabular-nums" data-testid="text-lightbox-count">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        <button ref={closeRef} onClick={onClose} className="grid h-11 w-11 place-items-center hover:text-gold" aria-label="Close gallery" data-testid="button-lightbox-close">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-20 pb-6">
        <img
          key={img.id}
          src={imageUrl(img.basePath, 2000)}
          srcSet={imageSrcSet(img.basePath)}
          sizes="100vw"
          alt={img.alt || title}
          className="max-h-full max-w-full object-contain page-in"
        />
        {count > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full border border-[hsl(var(--ivory)/0.25)] bg-black/30 hover:border-[hsl(var(--gold))] hover:text-gold" aria-label="Previous image" data-testid="button-lightbox-prev">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full border border-[hsl(var(--ivory)/0.25)] bg-black/30 hover:border-[hsl(var(--gold))] hover:text-gold" aria-label="Next image" data-testid="button-lightbox-next">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {img.alt && <p className="text-center text-sm text-[hsl(var(--ivory)/0.6)] pb-6 px-6">{img.alt}</p>}
    </div>,
    document.body,
  );
}
