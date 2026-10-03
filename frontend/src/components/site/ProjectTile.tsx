import { Link } from "wouter";
import type { ProjectWithImages } from "@shared/schema";
import { coverOf } from "@/lib/site";
import { Picture } from "./primitives";
import { cn } from "@/lib/utils";

/** Editorial project tile — image first, quiet caption, no "card" chrome. */
export function ProjectTile({
  project,
  index,
  aspect = "aspect-[4/5]",
  sizes = "(min-width: 1024px) 45vw, 100vw",
  className,
}: {
  project: ProjectWithImages;
  index?: number;
  aspect?: string;
  sizes?: string;
  className?: string;
}) {
  const cover = coverOf(project);
  return (
    <Link
      href={`/work/${project.slug}`}
      className={cn("group block zoom-img", className)}
      data-testid={`link-project-${project.slug}`}
    >
      <Picture
        base={cover?.basePath ?? ""}
        alt={cover?.alt || project.name}
        sizes={sizes}
        className={cn(aspect, "w-full")}
        width={cover?.width}
        height={cover?.height}
      />
      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <h3 className="font-display text-2xl md:text-[1.75rem] leading-tight">{project.name}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {project.location}
            {project.category && <span className="text-gold-deep"> · {project.category.name}</span>}
          </p>
        </div>
        {typeof index === "number" && (
          <span className="eyebrow tabular-nums text-muted-foreground pt-2">{String(index + 1).padStart(2, "0")}</span>
        )}
      </div>
    </Link>
  );
}
