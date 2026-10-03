import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { serviceInput, type Service } from "@shared/schema";
import { apiJson, imageUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete, EmptyState, Labeled, PageHeader, Panel, SingleImageField, useAdminMutation } from "./ui";

type FormValues = z.input<typeof serviceInput>;
const empty: FormValues = { name: "", tagline: "", description: "", imagePath: "", visible: true, sortOrder: 0 };

function ServiceDialog({ open, onOpenChange, service }: { open: boolean; onOpenChange: (o: boolean) => void; service: Service | null }) {
  const form = useForm<FormValues>({ resolver: zodResolver(serviceInput), defaultValues: empty });
  useEffect(() => {
    if (open) form.reset(service ? { name: service.name, tagline: service.tagline, description: service.description, imagePath: service.imagePath, visible: service.visible, sortOrder: service.sortOrder } : empty);
  }, [open, service, form]);
  const save = useAdminMutation(
    (v: FormValues) => (service ? apiJson("PATCH", `/api/admin/services/${service.id}`, v) : apiJson("POST", "/api/admin/services", v)),
    service ? "Service saved" : "Service added",
    () => onOpenChange(false),
  );
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{service ? "Edit service" : "Add service"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4" data-testid="form-service">
          <Labeled label="Name" htmlFor="s-name" error={errors.name?.message}><Input id="s-name" {...form.register("name")} data-testid="input-service-name" /></Labeled>
          <Labeled label="Tagline" htmlFor="s-tag" error={errors.tagline?.message}><Input id="s-tag" {...form.register("tagline")} /></Labeled>
          <Labeled label="Description" htmlFor="s-desc" error={errors.description?.message}><Textarea id="s-desc" rows={4} {...form.register("description")} data-testid="input-service-description" /></Labeled>
          <Controller control={form.control} name="imagePath" render={({ field }) => <SingleImageField label="Image" value={field.value ?? ""} onChange={field.onChange} />} />
          <div className="flex items-center gap-6">
            <Controller control={form.control} name="visible" render={({ field }) => (
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="switch-service-visible" /> Visible on website</label>
            )} />
            <label className="flex items-center gap-2 text-sm">Order <Input type="number" className="w-20" {...form.register("sortOrder")} /></label>
          </div>
          <Button type="submit" disabled={save.isPending} data-testid="button-save-service">{save.isPending && <Loader2 className="animate-spin" />} Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Services() {
  const { data, isLoading } = useQuery<Service[]>({ queryKey: ["/api/admin/services"] });
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Service | null>(null);
  const toggle = useAdminMutation((v: { id: number; visible: boolean }) => apiJson("PATCH", `/api/admin/services/${v.id}`, { visible: v.visible }), "Visibility updated");
  const remove = useAdminMutation((id: number) => apiJson("DELETE", `/api/admin/services/${id}`), "Service deleted");
  return (
    <>
      <PageHeader
        title="Services"
        description="Shown on the home page and used as “Project type” options in the enquiry form."
        actions={<Button onClick={() => { setCurrent(null); setOpen(true); }} data-testid="button-add-service"><Plus /> Add service</Button>}
      />
      <Panel>
        {isLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : !data?.length ? (
          <EmptyState title="No services" body="Add the services you offer." />
        ) : (
          <ul className="divide-y divide-card-border">
            {data.map((s) => (
              <li key={s.id} className="flex items-center gap-4 p-3 sm:p-4" data-testid={`row-service-${s.id}`}>
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-sm bg-muted">{s.imagePath && <img src={imageUrl(s.imagePath, 640)} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.tagline}</p>
                </div>
                <label className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={s.visible} onCheckedChange={(v) => toggle.mutate({ id: s.id, visible: v })} aria-label={`Show ${s.name}`} data-testid={`switch-service-${s.id}`} />
                  {s.visible ? "Visible" : "Hidden"}
                </label>
                <Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => { setCurrent(s); setOpen(true); }} data-testid={`button-edit-service-${s.id}`}><Pencil /></Button>
                <ConfirmDelete title={`Delete ${s.name}?`} description="It will be removed from the website and the enquiry form." onConfirm={() => remove.mutate(s.id)} testId={`button-delete-service-${s.id}`} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ServiceDialog open={open} onOpenChange={setOpen} service={current} />
    </>
  );
}
