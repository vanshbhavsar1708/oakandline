import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Expand } from "lucide-react";
import type { ProjectWithImages } from "@shared/schema";
import { coverOf, useSeo } from "@/lib/site";
import { imageUrl } from "@/lib/queryClient";
import { Picture, Reveal, SectionLabel } from "@/components/site/primitives";
import { CtaLink, WhatsAppCta } from "@/components/site/cta";
import { ProjectTile } from "@/components/site/ProjectTile";
import { Lightbox } from "@/components/site/Lightbox";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery<{ project: ProjectWithImages; related: ProjectWithImages[] }>({
    queryKey: [`/api/projects/${slug}`],
  });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const p = data?.project;
  const cover = p ? coverOf(p) : undefined;

  useSeo({
    title: p ? `${p.name} — ${p.category?.name ?? "Interior"} in ${p.location}` : "Project",
    description: p?.summary || p?.description.slice(0, 155),
    image: cover ? imageUrl(cover.basePath, 1280) : undefined,
  });

  if (isLoading)
    return (
      <div className="pt-36 container-x space-y-6">
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="aspect-[16/9] w-full" />
      </div>
    );
  if (error || !p) return <NotFound />;

  const gallery = p.images;
  const facts = [
    { k: "Location", v: p.location },
    { k: "Category", v: p.category?.name },
    { k: "Area", v: p.areaSqft ? `${p.areaSqft.toLocaleString("en-IN")} sq ft (approx.)` : undefined },
    { k: "Completed", v: p.year ? String(p.year) : undefined },
  ].filter((f) => f.v);

  return (
    <article>
      <header className="pt-32 md:pt-44 pb-12 md:pb-16">
        <div className="container-x">
          <Link href="/work" className="inline-flex items-center gap-2 eyebrow text-muted-foreground hover:text-foreground" data-testid="link-back-work">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All work
          </Link>
          <div className="mt-10 grid gap-8 md:grid-cols-12 items-end">
            <div className="md:col-span-8">
              <SectionLabel>{p.category?.name ?? "Project"}</SectionLabel>
              <h1 className="font-display mt-5 text-5xl md:text-7xl lg:text-[5.75rem] leading-[0.98]" data-testid="text-project-name">
                {p.name}
              </h1>
              {p.summary && <p className="mt-5 text-lg md:text-xl text-foreground/75 max-w-2xl">{p.summary}</p>}
            </div>
          </div>
        </div>
      </header>

      {cover && (
        <button
          type="button"
          onClick={() => setLightbox(0)}
          className="group relative block w-full zoom-img"
          aria-label={`Open gallery for ${p.name}`}
          data-testid="button-open-cover"
        >
          <Picture base={cover.basePath} alt={cover.alt || p.name} priority sizes="100vw" className="aspect-[4/3] md:aspect-[21/9] w-full" />
          <span className="absolute bottom-5 right-5 inline-flex items-center gap-2 bg-[hsl(var(--ink)/0.7)] px-4 py-2 eyebrow text-ivory opacity-90 group-hover:opacity-100">
            <Expand className="h-3.5 w-3.5" aria-hidden="true" /> {gallery.length} images
          </span>
        </button>
      )}

      <section className="py-20 md:py-28">
        <div className="container-x grid gap-14 md:grid-cols-12">
          <dl className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-6 md:gap-0 md:divide-y md:divide-border self-start">
            {facts.map((f) => (
              <div key={f.k} className="md:py-5 first:md:pt-0">
                <dt className="eyebrow text-muted-foreground">{f.k}</dt>
                <dd className="mt-2 text-lg" data-testid={`text-fact-${f.k.toLowerCase()}`}>{f.v}</dd>
              </div>
            ))}
          </dl>
          <div className="md:col-span-7 md:col-start-6">
            <p className="font-display text-2xl md:text-[2rem] leading-[1.35] text-foreground/90 whitespace-pre-line">{p.description}</p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <CtaLink href="/contact" testId="button-project-discuss">Discuss a Similar Project</CtaLink>
              <WhatsAppCta label="Ask on WhatsApp" projectName={p.name} testId="link-project-whatsapp" />
            </div>
          </div>
        </div>
      </section>

      {gallery.length > 1 && (
        <section className="pb-24 md:pb-32" aria-label={`${p.name} gallery`}>
          <div className="container-x columns-1 sm:columns-2 gap-4 md:gap-6 [&>*]:mb-4 md:[&>*]:mb-6">
            {gallery.map((img, i) => (
              <Reveal key={img.id} className="break-inside-avoid">
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="block w-full zoom-img"
                  aria-label={`View image ${i + 1}: ${img.alt}`}
                  data-testid={`button-gallery-${i}`}
                >
                  <Picture
                    base={img.basePath}
                    alt={img.alt || p.name}
                    sizes="(min-width: 640px) 50vw, 100vw"
                    width={img.width}
                    height={img.height}
                    className="w-full"
                    imgClassName="h-auto"
                  />
                </button>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {data.related.length > 0 && (
        <section className="py-24 md:py-32 bg-[hsl(var(--secondary))]" aria-labelledby="related-title">
          <div className="container-x">
            <h2 id="related-title" className="font-display text-4xl md:text-5xl mb-12">More homes</h2>
            <div className="grid gap-12 md:grid-cols-3">
              {data.related.map((r) => (
                <ProjectTile key={r.id} project={r} sizes="(min-width: 768px) 33vw, 100vw" />
              ))}
            </div>
          </div>
        </section>
      )}

      {lightbox !== null && (
        <Lightbox images={gallery} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} title={p.name} />
      )}
    </article>
  );
}
