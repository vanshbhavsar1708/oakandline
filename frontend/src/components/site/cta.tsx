import type { ReactNode } from "react";
import { Link } from "wouter";
import { SiWhatsapp } from "react-icons/si";
import { ArrowUpRight } from "lucide-react";
import { useSite } from "@/lib/site";
import { buildContextMessage, waLink } from "@shared/whatsapp";
import { cn } from "@/lib/utils";

type Variant = "solid" | "gold" | "outline" | "outline-light" | "ghost-light";

const base =
  "group inline-flex items-center justify-center gap-3 min-h-[48px] px-7 text-[0.8rem] font-medium uppercase tracking-[0.16em] transition-[background-color,color,border-color,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  solid: "bg-[hsl(var(--ink))] text-[hsl(var(--ivory))] hover:bg-[hsl(var(--gold-deep))]",
  gold: "bg-[hsl(var(--gold))] text-[hsl(var(--ink))] hover:bg-[hsl(var(--ivory))]",
  outline: "border border-[hsl(var(--ink))] text-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--ivory))]",
  "outline-light":
    "border border-[hsl(var(--ivory)/0.6)] text-[hsl(var(--ivory))] hover:bg-[hsl(var(--ivory))] hover:text-[hsl(var(--ink))]",
  "ghost-light": "text-[hsl(var(--ivory))] px-0 hover:text-[hsl(var(--gold))]",
};

export function CtaLink({
  href,
  children,
  variant = "solid",
  className,
  arrow = true,
  testId,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
  arrow?: boolean;
  testId?: string;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], className)} data-testid={testId}>
      <span>{children}</span>
      {arrow && (
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function ctaClass(variant: Variant = "solid", className?: string) {
  return cn(base, variants[variant], className);
}

/**
 * WhatsApp CTA — sends a contextual message (project / service) to the default
 * business number. Enquiry-form submissions use city routing on the server instead.
 */
export function WhatsAppCta({
  label = "Talk to Us on WhatsApp",
  projectName,
  serviceName,
  variant = "outline",
  className,
  testId = "link-whatsapp",
}: {
  label?: string;
  projectName?: string;
  serviceName?: string;
  variant?: Variant;
  className?: string;
  testId?: string;
}) {
  const { data } = useSite();
  const number = data?.content.defaultWhatsapp ?? "";
  const href = waLink(number, buildContextMessage({ projectName, serviceName }, data?.content.brandName));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, variants[variant], className)}
      data-testid={testId}
    >
      <SiWhatsapp className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}

export function WhatsAppFab() {
  const { data } = useSite();
  if (!data) return null;
  const href = waLink(data.content.defaultWhatsapp, buildContextMessage({}, data.content.brandName));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Oak & Line on WhatsApp"
      data-testid="button-whatsapp-fab"
      className="fixed z-40 bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 md:right-8 md:bottom-8 grid h-14 w-14 place-items-center rounded-full bg-[hsl(var(--ink))] text-[hsl(var(--ivory))] shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] ring-1 ring-[hsl(var(--gold)/0.5)] transition-transform duration-500 hover:scale-105 hover:bg-[hsl(var(--gold-deep))]"
    >
      <SiWhatsapp className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
