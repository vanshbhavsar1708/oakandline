import { useSeo } from "@/lib/site";
import { CtaLink } from "@/components/site/cta";

export default function NotFound() {
  useSeo({ title: "Page not found" });
  return (
    <section className="min-h-[80vh] grid place-items-center pt-28 pb-20">
      <div className="container-x text-center" data-testid="status-not-found">
        <p className="eyebrow text-gold-deep">404</p>
        <h1 className="font-display mt-6 text-5xl md:text-6xl">This room doesn't exist.</h1>
        <p className="mt-4 text-muted-foreground">The page may have moved, or the project is no longer published.</p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
          <CtaLink href="/work">View Our Work</CtaLink>
          <CtaLink href="/" variant="outline" arrow={false}>Back to home</CtaLink>
        </div>
      </div>
    </section>
  );
}
