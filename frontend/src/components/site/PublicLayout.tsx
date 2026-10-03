import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { Logo } from "./primitives";
import { CtaLink, WhatsAppFab } from "./cta";
import { useSite } from "@/lib/site";
import { cn } from "@/lib/utils";

export function scrollToSection(id: string, navigate: (to: string) => void, location: string) {
  const go = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (location !== "/") {
    navigate("/");
    setTimeout(go, 350);
  } else go();
}

const NAV: { label: string; href?: string; section?: string }[] = [
  { label: "Work", href: "/work" },
  { label: "Services", section: "services" },
  { label: "Studio", section: "studio" },
  { label: "Contact", href: "/contact" },
];

function Header() {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overHero = location === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navItem = (item: (typeof NAV)[number], mobile = false) => {
    const cls = cn(
      mobile
        ? "font-display text-4xl text-[hsl(var(--ivory))] py-2"
        : "text-[0.78rem] uppercase tracking-[0.18em] link-line pb-1",
      !mobile && item.href && location.startsWith(item.href) && "bg-[length:100%_1px]",
    );
    if (item.href)
      return (
        <Link key={item.label} href={item.href} className={cls} data-testid={`link-nav-${item.label.toLowerCase()}`}>
          {item.label}
        </Link>
      );
    return (
      <button
        key={item.label}
        type="button"
        className={cn(cls, "text-left")}
        onClick={() => {
          setOpen(false);
          scrollToSection(item.section!, navigate, location);
        }}
        data-testid={`link-nav-${item.label.toLowerCase()}`}
      >
        {item.label}
      </button>
    );
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,color,box-shadow,backdrop-filter] duration-500",
        overHero
          ? "text-[hsl(var(--ivory))] bg-gradient-to-b from-black/45 to-transparent"
          : "text-foreground bg-[hsl(var(--background)/0.92)] backdrop-blur-md shadow-[0_1px_0_hsl(var(--border))]",
      )}
    >
      <div className="container-x flex h-[72px] md:h-[84px] items-center justify-between">
        <Link href="/" aria-label="Oak & Line — home" data-testid="link-home">
          <Logo tone={overHero ? "light" : "dark"} />
        </Link>
        <nav aria-label="Primary" className="hidden md:flex items-center gap-10">
          {NAV.map((n) => navItem(n))}
          <CtaLink
            href="/contact"
            variant={overHero ? "outline-light" : "solid"}
            className="min-h-[42px] px-5"
            testId="button-header-cta"
          >
            Discuss Your Project
          </CtaLink>
        </nav>
        <button
          type="button"
          className="md:hidden -mr-2 grid h-11 w-11 place-items-center"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="button-menu"
        >
          {open ? <X className="h-6 w-6 text-[hsl(var(--ivory))] relative z-[60]" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-[55] bg-[hsl(var(--ink))] transition-opacity duration-500",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div className="container-x flex h-full flex-col pt-28 pb-10">
          <nav aria-label="Mobile" className="flex flex-col gap-2">
            {NAV.map((n) => navItem(n, true))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <CtaLink href="/contact" variant="gold" testId="button-mobile-cta">
              Discuss Your Project
            </CtaLink>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { data } = useSite();
  const c = data?.content;
  const cities = data?.cities ?? [];
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-ivory" data-testid="footer">
      <div className="container-x py-20 md:py-24 grid gap-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo tone="light" />
          <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-[hsl(var(--ivory)/0.65)]">
            Bespoke residential interiors and modular furniture — designed, built and installed by one accountable team.
          </p>
        </div>
        <div className="md:col-span-3">
          <h2 className="eyebrow text-gold mb-5">Studio</h2>
          <ul className="space-y-3 text-[0.95rem] text-[hsl(var(--ivory)/0.8)]">
            <li><Link href="/work" className="link-line">Our Work</Link></li>
            <li><Link href="/contact" className="link-line">Book a Consultation</Link></li>
            <li><Link href="/play" className="link-line" data-testid="link-footer-play">Material Match — a short game</Link></li>
          </ul>
        </div>
        <div className="md:col-span-4">
          <h2 className="eyebrow text-gold mb-5">Contact</h2>
          <ul className="space-y-3 text-[0.95rem] text-[hsl(var(--ivory)/0.8)]">
            {c?.phone && <li><a className="link-line" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></li>}
            {c?.email && <li><a className="link-line" href={`mailto:${c.email}`}>{c.email}</a></li>}
            {cities.length > 0 && (
              <li className="text-[hsl(var(--ivory)/0.6)]">Serving {cities.map((x) => x.name).join(" · ")}</li>
            )}
            {c?.instagram && (
              <li>
                <a className="inline-flex items-center gap-2 link-line" href={c.instagram} target="_blank" rel="noopener noreferrer">
                  <SiInstagram className="h-4 w-4" aria-hidden="true" /> Instagram
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-[hsl(var(--ivory)/0.1)]">
        <div className="container-x flex flex-col md:flex-row gap-3 justify-between py-6 text-xs text-[hsl(var(--ivory)/0.5)]">
          <span>© {year} {c?.brandName ?? "Oak & Line"} Interiors. All rights reserved.</span>
          <Link href="/admin" className="link-line" data-testid="link-admin">Studio login</Link>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:bg-background focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} key={location} className="flex-1 page-in outline-none">
        {children}
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
