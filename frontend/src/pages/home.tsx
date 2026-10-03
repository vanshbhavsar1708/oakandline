import { useLocation } from "wouter";
import { ArrowDown } from "lucide-react";
import type { Owner, Service } from "@shared/schema";
import { useProjects, useSeo, useSite } from "@/lib/site";
import { Picture, Reveal, SectionLabel } from "@/components/site/primitives";
import { CtaLink, WhatsAppCta } from "@/components/site/cta";
import { ProjectTile } from "@/components/site/ProjectTile";
import { scrollToSection } from "@/components/site/PublicLayout";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------- Hero ------------------------------- */
function Hero() {
  const { data } = useSite();
  const [location, navigate] = useLocation();
  const c = data?.content;
  return (
    <section className="relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-ink" aria-labelledby="hero-title">
      <Picture
        base={c?.heroImagePath || "./images/hero"}
        alt="Warm walnut and ivory living room designed by Oak & Line"
        priority
        sizes="100vw"
        className="absolute inset-0"
        imgClassName="hero-img object-[60%_center] md:object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/5" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />

      <div className="relative container-x h-full flex flex-col justify-end pb-16 md:pb-24">
        <div className="hero-in max-w-3xl text-ivory">
          <p className="eyebrow text-gold">{c?.heroEyebrow ?? "Residential Interiors · Modular Furniture"}</p>
          <h1 id="hero-title" className="font-display mt-6 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[5.5rem]">
            {c?.heroHeadline ?? "Homes shaped with quiet precision."}
          </h1>
          <p className="mt-6 max-w-xl text-base md:text-lg leading-relaxed text-[hsl(var(--ivory)/0.82)]">
            {c?.heroSubheadline}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <CtaLink href="/contact" variant="gold" testId="button-hero-discuss">
              Discuss Your Project
            </CtaLink>
            <CtaLink href="/work" variant="outline-light" arrow={false} testId="button-hero-work">
              View Our Work
            </CtaLink>
          </div>
        </div>
        <button
          type="button"
          onClick={() => scrollToSection("services", navigate, location)}
          className="hidden md:flex absolute right-[clamp(1.25rem,4vw,3rem)] bottom-24 items-center gap-3 eyebrow text-[hsl(var(--ivory)/0.75)] hover:text-ivory"
          data-testid="button-scroll"
        >
          Scroll <ArrowDown className="h-4 w-4 animate-bounce [animation-duration:2.4s]" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/* ----------------------------- Services ----------------------------- */
function ServiceRow({ s, i }: { s: Service; i: number }) {
  const flip = i % 2 === 1;
  return (
    <Reveal
      as="article"
      className="grid gap-8 md:gap-14 md:grid-cols-12 items-center"
      data-testid={`row-service-${s.slug}`}
    >
      <div className={`md:col-span-7 ${flip ? "md:order-2" : ""}`}>
        <div className="zoom-img">
          <Picture base={s.imagePath} alt={`${s.name} by Oak & Line`} sizes="(min-width: 768px) 58vw, 100vw" className="aspect-[4/3] w-full" />
        </div>
      </div>
      <div className={`md:col-span-5 ${flip ? "md:order-1 md:pr-6" : "md:pl-6"}`}>
        <span className="eyebrow tabular-nums text-gold-deep">{String(i + 1).padStart(2, "0")}</span>
        <h3 className="font-display mt-4 text-3xl md:text-[2.6rem] leading-[1.08]">{s.name}</h3>
        {s.tagline && <p className="mt-3 text-lg text-foreground/80">{s.tagline}</p>}
        <p className="mt-5 text-[0.98rem] leading-relaxed text-muted-foreground max-w-md">{s.description}</p>
        <div className="mt-8">
          <WhatsAppCta label="Get a Consultation" serviceName={s.name} variant="outline" testId={`link-service-wa-${s.slug}`} />
        </div>
      </div>
    </Reveal>
  );
}

function Services() {
  const { data, isLoading } = useSite();
  const services = data?.services ?? [];
  return (
    <section id="services" className="py-24 md:py-36 scroll-mt-20" aria-labelledby="services-title">
      <div className="container-x">
        <div className="grid md:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="md:col-span-5">
            <SectionLabel index="01">Services</SectionLabel>
            <h2 id="services-title" className="font-display mt-6 text-4xl md:text-6xl leading-[1.04]">
              Every room, considered.
            </h2>
          </div>
          <p className="md:col-span-5 md:col-start-8 self-end text-muted-foreground leading-relaxed">
            From a single kitchen to a complete home, each space is planned to the millimetre and finished by our own
            craftsmen — so what you approve on paper is exactly what you live with.
          </p>
        </div>
        {isLoading ? (
          <div className="grid md:grid-cols-12 gap-10">
            <Skeleton className="md:col-span-7 aspect-[4/3]" />
            <div className="md:col-span-5 space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /></div>
          </div>
        ) : services.length === 0 ? (
          <p className="text-muted-foreground">Our service list is being updated — please check back shortly.</p>
        ) : (
          <div className="space-y-24 md:space-y-32">
            {services.map((s, i) => (
              <ServiceRow key={s.id} s={s} i={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ About ------------------------------- */
function About() {
  const { data } = useSite();
  const c = data?.content;
  return (
    <section id="studio" className="bg-ink text-ivory py-24 md:py-36 scroll-mt-20" aria-labelledby="about-title">
      <div className="container-x grid gap-14 md:grid-cols-12">
        <div className="md:col-span-6">
          <SectionLabel index="02" light>About the studio</SectionLabel>
          <Reveal>
            <h2 id="about-title" className="font-display mt-6 text-4xl md:text-[3.6rem] leading-[1.05]">
              {c?.aboutHeading}
            </h2>
            <p className="mt-8 max-w-xl text-[1.02rem] leading-relaxed text-[hsl(var(--ivory)/0.72)]">{c?.aboutBody}</p>
          </Reveal>
          {c?.stats && c.stats.length > 0 && (
            <dl className="mt-14 grid grid-cols-3 gap-6 border-t border-[hsl(var(--ivory)/0.14)] pt-8 max-w-xl">
              {c.stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-display text-3xl md:text-4xl text-gold">{s.value}</dd>
                  <dd className="mt-2 text-xs md:text-sm text-[hsl(var(--ivory)/0.6)]">{s.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="md:col-span-5 md:col-start-8">
          <Reveal variant="img-reveal">
            <Picture base="./images/studio" alt="Material samples — walnut, brass, travertine and cane" sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/5] w-full" />
          </Reveal>
        </div>
        <ul className="md:col-span-12 mt-6 grid gap-px bg-[hsl(var(--ivory)/0.12)] sm:grid-cols-2 lg:grid-cols-4">
          {(c?.aboutPillars ?? []).map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 80} className="bg-ink p-7 md:p-8">
              <span className="eyebrow text-gold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 text-lg font-medium">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--ivory)/0.62)]">{p.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------ Owners ------------------------------ */
export function OwnerProfile({ owner, i }: { owner: Owner; i: number }) {
  return (
    <Reveal as="article" delay={i * 120} className="grid gap-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-end" data-testid={`card-owner-${i}`}>
      <Picture base={owner.imagePath} alt={`Portrait of ${owner.name}`} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 100vw" className="aspect-[3/4] w-full" />
      <div className="pb-2">
        <p className="eyebrow text-gold-deep">{owner.role}</p>
        <h3 className="font-display mt-3 text-3xl md:text-4xl">{owner.name}</h3>
        {owner.bio && <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">{owner.bio}</p>}
        {owner.focus.length > 0 && (
          <ul className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
            {owner.focus.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="h-px w-4 bg-[hsl(var(--gold))]" aria-hidden="true" /> {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Reveal>
  );
}

function Owners() {
  const { data } = useSite();
  const owners = data?.content.owners ?? [];
  if (!owners.length) return null;
  return (
    <section className="py-24 md:py-36" aria-labelledby="owners-title">
      <div className="container-x">
        <SectionLabel index="03">The people behind the work</SectionLabel>
        <h2 id="owners-title" className="font-display mt-6 mb-16 md:mb-20 text-4xl md:text-6xl leading-[1.04] max-w-3xl">
          Led by its founders, on every project.
        </h2>
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-14">
          {owners.map((o, i) => (
            <OwnerProfile key={o.name + i} owner={o} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Featured work -------------------------- */
function FeaturedWork() {
  const { data: projects, isLoading, isError } = useProjects({ featured: true });
  const list = (projects ?? []).slice(0, 4);
  return (
    <section className="py-24 md:py-36 bg-[hsl(var(--secondary))]" aria-labelledby="work-title">
      <div className="container-x">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-14 md:mb-20">
          <div>
            <SectionLabel index="04">Selected work</SectionLabel>
            <h2 id="work-title" className="font-display mt-6 text-4xl md:text-6xl leading-[1.04]">Recent homes.</h2>
          </div>
          <CtaLink href="/work" variant="outline" testId="button-explore-work">Explore Our Work</CtaLink>
        </div>
        {isLoading ? (
          <div className="grid gap-10 md:grid-cols-2">
            <Skeleton className="aspect-[4/5]" /><Skeleton className="aspect-[4/5]" />
          </div>
        ) : isError ? (
          <p className="text-muted-foreground">We couldn't load projects right now. Please refresh the page.</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground">New projects are being photographed — check back soon.</p>
        ) : (
          <div className="grid gap-x-10 gap-y-16 md:grid-cols-2">
            {list.map((p, i) => (
              <Reveal key={p.id} delay={(i % 2) * 120} className={i % 2 === 1 ? "md:mt-28" : ""}>
                <ProjectTile project={p} index={i} aspect={i % 2 === 0 ? "aspect-[4/5]" : "aspect-[5/6]"} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ----------------------------- Final CTA ---------------------------- */
export function FinalCta() {
  const { data } = useSite();
  const c = data?.content;
  return (
    <section className="relative overflow-hidden bg-ink text-ivory" aria-labelledby="cta-title">
      <Picture base="./images/svc-fullhome" alt="" sizes="100vw" className="absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--ink))] via-[hsl(var(--ink)/0.75)] to-[hsl(var(--ink)/0.5)]" aria-hidden="true" />
      <div className="relative container-x py-28 md:py-40 text-center">
        <Reveal>
          <span className="mx-auto block h-12 w-px bg-[hsl(var(--gold))]" aria-hidden="true" />
          <h2 id="cta-title" className="font-display mx-auto mt-10 max-w-4xl text-4xl sm:text-5xl md:text-7xl leading-[1.04]">
            {c?.ctaHeadline || "Let's Create a Space That Feels Like Yours."}
          </h2>
          {c?.ctaBody && <p className="mx-auto mt-6 max-w-xl text-[hsl(var(--ivory)/0.72)] leading-relaxed">{c.ctaBody}</p>}
          <div className="mt-12 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <CtaLink href="/contact" variant="gold" testId="button-final-cta">Discuss Your Project</CtaLink>
            <WhatsAppCta variant="outline-light" testId="link-final-whatsapp" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  useSeo({
    title: "Oak & Line — Premium Home Interiors & Modular Furniture",
    description:
      "Bespoke residential interiors — modular kitchens, wardrobes, bedrooms, living spaces and complete homes, designed and built by Oak & Line.",
  });
  return (
    <>
      <Hero />
      <Services />
      <About />
      <Owners />
      <FeaturedWork />
      <FinalCta />
    </>
  );
}
