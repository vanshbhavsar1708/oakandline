import { useMemo, useState } from "react";
import type { ProjectWithImages } from "@shared/schema";
import { useProjects, useSeo, useSite } from "@/lib/site";
import { Reveal, SectionLabel } from "@/components/site/primitives";
import { ProjectTile } from "@/components/site/ProjectTile";
import { FinalCta } from "@/pages/home";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Editorial rhythm: wide/narrow pairs, then a full-bleed feature, repeat. */
const PATTERN = [
  { span: "md:col-span-7", aspect: "aspect-[4/3]" },
  { span: "md:col-span-5 md:mt-32", aspect: "aspect-[4/5]" },
  { span: "md:col-span-5", aspect: "aspect-[4/5]" },
  { span: "md:col-span-7 md:mt-24", aspect: "aspect-[4/3]" },
  { span: "md:col-span-12", aspect: "aspect-[16/9]" },
];

export default function Work() {
  useSeo({
    title: "Our Work — Residential Interior Portfolio",
    description: "Explore Oak & Line kitchens, bedrooms, living rooms, wardrobes and complete homes.",
  });
  const { data: site } = useSite();
  const { data: projects, isLoading, isError, refetch } = useProjects();
  const [active, setActive] = useState("all");

  const categories = useMemo(() => {
    const used = new Set((projects ?? []).map((p) => p.categoryId));
    return (site?.categories ?? []).filter((c) => used.has(c.id));
  }, [site, projects]);

  const filtered: ProjectWithImages[] = useMemo(
    () => (projects ?? []).filter((p) => active === "all" || p.category?.slug === active),
    [projects, active],
  );

  return (
    <>
      <section className="pt-36 md:pt-48 pb-14 md:pb-20">
        <div className="container-x">
          <SectionLabel>Portfolio</SectionLabel>
          <div className="mt-6 grid gap-8 md:grid-cols-12 items-end">
            <h1 className="md:col-span-7 font-display text-5xl md:text-7xl lg:text-[6rem] leading-[0.98]">Our work.</h1>
            <p className="md:col-span-4 md:col-start-9 text-muted-foreground leading-relaxed">
              A selection of homes we've designed and built — each one planned around the family who lives in it.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter projects by category"
            className="mt-14 flex gap-1 overflow-x-auto no-scrollbar border-b border-border"
          >
            {[{ id: 0, name: "All", slug: "all" }, ...categories].map((c) => {
              const selected = active === c.slug;
              return (
                <button
                  key={c.slug}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(c.slug)}
                  data-testid={`tab-category-${c.slug}`}
                  className={cn(
                    "relative shrink-0 px-4 first:pl-0 py-4 text-[0.78rem] uppercase tracking-[0.16em] transition-colors",
                    selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.name}
                  <span
                    className={cn(
                      "absolute left-4 right-4 [button:first-child>&]:left-0 bottom-0 h-[2px] bg-[hsl(var(--gold-deep))] origin-left transition-transform duration-500",
                      selected ? "scale-x-100" : "scale-x-0",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-28 md:pb-40" aria-live="polite">
        <div className="container-x">
          {isLoading ? (
            <div className="grid gap-10 md:grid-cols-12">
              <Skeleton className="md:col-span-7 aspect-[4/3]" />
              <Skeleton className="md:col-span-5 aspect-[4/5]" />
            </div>
          ) : isError ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">We couldn't load the portfolio.</p>
              <button className="mt-4 link-line" onClick={() => refetch()} data-testid="button-retry">Try again</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center" data-testid="status-empty">
              <p className="font-display text-3xl">Nothing here yet.</p>
              <p className="mt-3 text-muted-foreground">New projects in this category are on their way.</p>
            </div>
          ) : (
            <div key={active} className="grid gap-x-10 gap-y-16 md:gap-y-24 md:grid-cols-12 page-in">
              {filtered.map((p, i) => {
                const slot = PATTERN[i % PATTERN.length];
                return (
                  <Reveal key={p.id} className={cn("col-span-1", slot.span)} delay={(i % 2) * 100}>
                    <ProjectTile
                      project={p}
                      index={i}
                      aspect={slot.aspect}
                      sizes={slot.span.includes("12") ? "100vw" : "(min-width: 768px) 58vw, 100vw"}
                    />
                    {p.summary && <p className="mt-2 text-sm text-muted-foreground max-w-md">{p.summary}</p>}
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <FinalCta />
    </>
  );
}
