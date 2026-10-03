import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, ChevronLeft, Eye, ImageOff, Loader2, Plus, Search, Star } from "lucide-react";
import { projectInput, type Category, type ProjectImage, type ProjectWithImages } from "@shared/schema";
import { apiJson, imageUrl, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/supabase-upload";
import { coverOf, localHref } from "@/lib/site";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDelete, DropZone, EmptyState, Labeled, PageHeader, Panel, useAdminMutation, validateFiles } from "./ui";
import { cn } from "@/lib/utils";

const publicHref = (slug: string) => localHref(`/work/${slug}`);

/* =============================== LIST =============================== */
/** Photos per request — small batches stay well inside proxy time limits (e.g. Netlify → API host). */
const UPLOAD_BATCH = 4;

export function ProjectsList() {
  const { data, isLoading } = useQuery<ProjectWithImages[]>({ queryKey: ["/api/admin/projects"] });
  const { data: cats } = useQuery<Category[]>({ queryKey: ["/api/admin/categories"] });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const toggle = useAdminMutation((v: { id: number; published: boolean }) => apiJson("PATCH", `/api/admin/projects/${v.id}`, { published: v.published }), "Project updated");
  const remove = useAdminMutation((id: number) => apiJson("DELETE", `/api/admin/projects/${id}`), "Project deleted");

  const list = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          (cat === "all" || String(p.categoryId) === cat) &&
          (!q || `${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, q, cat],
  );

  return (
    <>
      <PageHeader
        title="Projects"
        description="Your portfolio. Only published projects with at least one photo appear on the website."
        actions={<Button asChild data-testid="button-add-project"><Link href="/projects/new"><Plus /> Add project</Link></Button>}
      />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or location" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="input-search-projects" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" data-testid="select-filter-category">
          <option value="all">All categories</option>
          {(cats ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>
      <Panel>
        {isLoading ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState
            title={data?.length ? "No projects match" : "No projects yet"}
            body={data?.length ? "Try a different search or category." : "Add your first project to start building the portfolio."}
            action={!data?.length && <Button asChild><Link href="/projects/new"><Plus /> Add project</Link></Button>}
          />
        ) : (
          <ul className="divide-y divide-card-border">
            {list.map((p) => {
              const cover = coverOf(p);
              return (
                <li key={p.id} className="flex items-center gap-4 p-3 sm:p-4" data-testid={`row-project-${p.id}`}>
                  <Link href={`/projects/${p.id}`} className="h-14 w-20 shrink-0 overflow-hidden rounded-sm bg-muted grid place-items-center">
                    {cover ? <img src={imageUrl(cover.basePath, 640)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff className="h-4 w-4 text-muted-foreground" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline truncate block" data-testid={`link-edit-project-${p.id}`}>
                      {p.name} {p.featured && <Star className="inline h-3.5 w-3.5 text-[hsl(var(--gold-deep))] fill-current -mt-0.5" aria-label="Featured" />}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">{p.location} · {p.category?.name ?? "Uncategorised"} · {p.images.length} photo{p.images.length === 1 ? "" : "s"}</p>
                  </div>
                  <label className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={p.published}
                      disabled={toggle.isPending}
                      onCheckedChange={(v) => toggle.mutate({ id: p.id, published: v })}
                      aria-label={`Publish ${p.name}`}
                      data-testid={`switch-publish-${p.id}`}
                    />
                    {p.published ? "Live" : "Draft"}
                  </label>
                  <ConfirmDelete
                    title={`Delete ${p.name}?`}
                    description="This removes the project and all of its photos from the website permanently."
                    onConfirm={() => remove.mutate(p.id)}
                    testId={`button-delete-project-${p.id}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* ============================== EDITOR ============================== */
type FormValues = z.input<typeof projectInput>;

export function ProjectEditor({ id }: { id: number | null }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = id === null;
  const { data: project, isLoading } = useQuery<ProjectWithImages>({ queryKey: [`/api/admin/projects/${id}`], enabled: !isNew });
  const { data: cats } = useQuery<Category[]>({ queryKey: ["/api/admin/categories"] });

  const form = useForm<FormValues>({
    resolver: zodResolver(projectInput),
    defaultValues: { name: "", location: "", categoryId: 0, summary: "", description: "", areaSqft: null, year: null, featured: false, published: false, sortOrder: 0 },
  });
  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = form;

  useEffect(() => {
    if (project)
      reset({
        name: project.name, location: project.location, categoryId: project.categoryId ?? 0, summary: project.summary,
        description: project.description, areaSqft: project.areaSqft, year: project.year, featured: project.featured,
        published: project.published, sortOrder: project.sortOrder,
      });
  }, [project, reset]);

  const save = useAdminMutation(
    (v: FormValues) => {
      const body = { ...v, areaSqft: v.areaSqft === ("" as unknown) || v.areaSqft == null ? null : v.areaSqft, year: v.year === ("" as unknown) || v.year == null ? null : v.year };
      return isNew ? apiJson<{ id: number }>("POST", "/api/admin/projects", { ...body, published: false }) : apiJson<{ id: number }>("PATCH", `/api/admin/projects/${id}`, body);
    },
    isNew ? "Project created — now add photos" : "Project saved",
    (r) => { if (isNew) navigate(`/projects/${r.id}`); },
  );

  if (!isNew && isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-60" /><Skeleton className="h-96" /></div>;
  if (!isNew && !project) return <EmptyState title="Project not found" action={<Button asChild variant="outline"><Link href="/projects">Back to projects</Link></Button>} />;

  return (
    <>
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ChevronLeft className="h-4 w-4" /> Projects</Link>
      <PageHeader
        title={isNew ? "New project" : project!.name}
        description={isNew ? "Add the details first, then upload photos on the next step." : undefined}
        actions={!isNew && project!.published && (
          <Button variant="outline" asChild><a href={publicHref(project!.slug)} target="_blank" rel="noopener noreferrer"><Eye /> View live</a></Button>
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel className="p-5 sm:p-6">
          <form onSubmit={handleSubmit((v) => save.mutate(v), () => toast({ title: "Check the highlighted fields", variant: "destructive" }))} noValidate className="space-y-5" data-testid="form-project">
            <Labeled label="Project name" htmlFor="p-name" error={errors.name?.message}>
              <Input id="p-name" placeholder="e.g. Monsoon House" {...register("name")} data-testid="input-project-name" />
            </Labeled>
            <div className="grid sm:grid-cols-2 gap-4">
              <Labeled label="Location" htmlFor="p-loc" hint="City or neighbourhood" error={errors.location?.message}>
                <Input id="p-loc" placeholder="e.g. Ahmedabad" {...register("location")} data-testid="input-project-location" />
              </Labeled>
              <Labeled label="Category" htmlFor="p-cat" error={errors.categoryId?.message}>
                <select id="p-cat" {...register("categoryId")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-project-category">
                  <option value={0}>Choose…</option>
                  {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Labeled>
            </div>
            <Labeled label="Short summary" htmlFor="p-sum" hint="One line shown under the title, e.g. “Warm walnut + ivory contemporary residence”" error={errors.summary?.message}>
              <Input id="p-sum" {...register("summary")} data-testid="input-project-summary" />
            </Labeled>
            <Labeled label="Description" htmlFor="p-desc" error={errors.description?.message}>
              <Textarea id="p-desc" rows={6} {...register("description")} data-testid="input-project-description" />
            </Labeled>
            <div className="grid grid-cols-3 gap-4">
              <Labeled label="Area (sq ft)" htmlFor="p-area" hint="Optional" error={errors.areaSqft?.message}>
                <Input id="p-area" type="number" inputMode="numeric" {...register("areaSqft", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} data-testid="input-project-area" />
              </Labeled>
              <Labeled label="Year" htmlFor="p-year" hint="Optional" error={errors.year?.message}>
                <Input id="p-year" type="number" inputMode="numeric" {...register("year", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} data-testid="input-project-year" />
              </Labeled>
              <Labeled label="Order" htmlFor="p-order" hint="Lower shows first" error={errors.sortOrder?.message}>
                <Input id="p-order" type="number" inputMode="numeric" {...register("sortOrder")} data-testid="input-project-order" />
              </Labeled>
            </div>
            <div className="flex flex-wrap gap-6 pt-1">
              <Controller control={control} name="featured" render={({ field }) => (
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="switch-featured" /> Feature on home page</label>
              )} />
              {!isNew && (
                <Controller control={control} name="published" render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm"><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="switch-published" /> Published</label>
                )} />
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={save.isPending || (!isNew && !isDirty)} data-testid="button-save-project">
                {save.isPending && <Loader2 className="animate-spin" />} {isNew ? "Create & add photos" : "Save changes"}
              </Button>
            </div>
          </form>
        </Panel>

        {isNew ? (
          <Panel className="p-6 grid place-items-center text-center text-sm text-muted-foreground min-h-[240px]">
            Photos can be uploaded once the project is created.
          </Panel>
        ) : (
          <GalleryManager project={project!} />
        )}
      </div>
    </>
  );
}

/* ========================= GALLERY MANAGER ========================= */
function GalleryManager({ project }: { project: ProjectWithImages }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<string[]>([]);
  const images = useMemo(() => [...project.images].sort((a, b) => a.sortOrder - b.sortOrder), [project.images]);

  const refresh = () => queryClient.invalidateQueries();

  const upload = async (files: File[]) => {
    const { ok, rejected } = validateFiles(files);
    if (rejected.length) toast({ title: `${rejected.length} file(s) skipped`, description: rejected.slice(0, 3).join("\n"), variant: "destructive" });
    if (!ok.length) return;
    const previews = ok.map((f) => URL.createObjectURL(f));
    setPending(previews);
    setUploading(true);
    let created = 0;
    const failed: string[] = [];
    try {
      // send in batches of 20 so 50+ photo projects work fine
      for (let i = 0; i < ok.length; i += UPLOAD_BATCH) {
        const batch = ok.slice(i, i + UPLOAD_BATCH);
        const fd = new FormData();
        batch.forEach((f) => fd.append("images", f));
        const res = await apiUpload<{ created: ProjectImage[]; failed: { file: string; reason: string }[] }>(
          `/api/admin/projects/${project.id}/images`,
          fd,
          (pct) => setProgress(Math.round(((i + (pct / 100) * batch.length) / ok.length) * 100)),
        );
        created += res.created.length;
        failed.push(...res.failed.map((f) => `${f.file}: ${f.reason}`));
      }
      toast({ title: `${created} photo${created === 1 ? "" : "s"} added`, description: failed.length ? failed.join("\n") : undefined, variant: failed.length ? "destructive" : undefined });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPending([]);
      setUploading(false);
      setProgress(0);
      refresh();
    }
  };

  const update = useAdminMutation((v: { id: number; patch: Partial<ProjectImage> }) => apiJson("PATCH", `/api/admin/images/${v.id}`, v.patch));
  const remove = useAdminMutation((imgId: number) => apiJson("DELETE", `/api/admin/images/${imgId}`), "Photo removed");
  const reorder = useAdminMutation((ids: number[]) => apiJson("POST", `/api/admin/projects/${project.id}/images/reorder`, { ids }));

  const move = (idx: number, dir: -1 | 1) => {
    const ids = images.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  };

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold">Photos <span className="text-muted-foreground font-normal">({images.length})</span></h2>
        <span className="text-xs text-muted-foreground">The starred photo is the cover.</span>
      </div>
      <DropZone onFiles={upload} busy={uploading} progress={progress} />
      {images.length === 0 && !pending.length && (
        <p className="mt-4 text-sm text-muted-foreground">No photos yet. A project needs at least one photo before it can be published.</p>
      )}
      <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="list-project-images">
        {images.map((img, idx) => (
          <li key={img.id} className={cn("group relative rounded-sm overflow-hidden border", img.isCover ? "border-[hsl(var(--gold))] ring-1 ring-[hsl(var(--gold))]" : "border-card-border")} data-testid={`item-image-${img.id}`}>
            <img src={imageUrl(img.basePath, 640)} alt={img.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between gap-1 bg-card px-1.5 py-1">
              <div className="flex">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move earlier" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowLeft /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move later" disabled={idx === images.length - 1} onClick={() => move(idx, 1)}><ArrowRight /></Button>
              </div>
              <div className="flex">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Set as cover" disabled={img.isCover} onClick={() => update.mutate({ id: img.id, patch: { isCover: true } })} data-testid={`button-cover-${img.id}`}>
                  <Star className={cn(img.isCover && "fill-[hsl(var(--gold))] text-[hsl(var(--gold-deep))]")} />
                </Button>
                <ConfirmDelete title="Delete this photo?" description="It will be removed from the website immediately." onConfirm={() => remove.mutate(img.id)} testId={`button-delete-image-${img.id}`} />
              </div>
            </div>
            <input
              defaultValue={img.alt}
              onBlur={(e) => e.target.value !== img.alt && update.mutate({ id: img.id, patch: { alt: e.target.value } })}
              placeholder="Describe this photo (for SEO)"
              aria-label="Photo description"
              className="w-full border-t border-card-border bg-background px-2 py-1.5 text-xs focus:outline-none"
            />
          </li>
        ))}
        {pending.map((src) => (
          <li key={src} className="relative rounded-sm overflow-hidden border border-dashed">
            <img src={src} alt="" className="aspect-[4/3] w-full object-cover opacity-50" />
            <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
