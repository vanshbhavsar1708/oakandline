import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, Pencil, Plus } from "lucide-react";
import { cityInput, managerInput, type CityManager, type CityWithManager } from "@shared/schema";
import { normaliseWhatsapp } from "@shared/whatsapp";
import { apiJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete, EmptyState, Labeled, PageHeader, Panel, useAdminMutation } from "./ui";
import { cn } from "@/lib/utils";

type CityForm = z.input<typeof cityInput>;
type ManagerForm = z.input<typeof managerInput>;

function routeFor(c: CityWithManager) {
  if (normaliseWhatsapp(c.routingWhatsapp)) return { to: `Override line ${c.routingWhatsapp}`, ok: true };
  if (c.manager && c.manager.active && normaliseWhatsapp(c.manager.whatsapp)) return { to: c.manager.name, ok: true };
  return { to: "Head office (default number)", ok: false };
}

function CityDialog({ open, onOpenChange, city, managers }: { open: boolean; onOpenChange: (o: boolean) => void; city: CityWithManager | null; managers: CityManager[] }) {
  const form = useForm<CityForm>({ resolver: zodResolver(cityInput) });
  useEffect(() => {
    if (open)
      form.reset(
        city
          ? { name: city.name, state: city.state, enabled: city.enabled, sortOrder: city.sortOrder, managerId: city.managerId, routingWhatsapp: city.routingWhatsapp, routingEmail: city.routingEmail, routingNotes: city.routingNotes }
          : { name: "", state: "Gujarat", enabled: true, sortOrder: 0, managerId: null, routingWhatsapp: "", routingEmail: "", routingNotes: "" },
      );
  }, [open, city, form]);
  const save = useAdminMutation(
    (v: CityForm) => (city ? apiJson("PATCH", `/api/admin/cities/${city.id}`, v) : apiJson("POST", "/api/admin/cities", v)),
    city ? "City saved" : "City added — it's now available in the enquiry form",
    () => onOpenChange(false),
  );
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{city ? `Edit ${city.name}` : "Add city"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4" data-testid="form-city">
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="City" htmlFor="c-name" error={errors.name?.message}><Input id="c-name" placeholder="e.g. Rajkot" {...form.register("name")} data-testid="input-city-name" /></Labeled>
            <Labeled label="State" htmlFor="c-state" error={errors.state?.message}><Input id="c-state" {...form.register("state")} /></Labeled>
          </div>
          <Labeled label="Assigned manager" htmlFor="c-mgr" hint="Enquiries from this city go to this person on WhatsApp.">
            <select
              id="c-mgr"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("managerId", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
              data-testid="select-city-manager"
            >
              <option value="">No manager — use head office</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}{!m.active ? " (inactive)" : ""}</option>)}
            </select>
          </Labeled>
          <Labeled label="Routing WhatsApp override" htmlFor="c-wa" hint="Optional. Use when this city has its own line (with country code, e.g. 9198…)." error={errors.routingWhatsapp?.message}>
            <Input id="c-wa" inputMode="tel" {...form.register("routingWhatsapp")} data-testid="input-city-whatsapp" />
          </Labeled>
          <Labeled label="Routing email" htmlFor="c-email" hint="Optional. For future email notifications." error={errors.routingEmail?.message}>
            <Input id="c-email" type="email" {...form.register("routingEmail")} />
          </Labeled>
          <Labeled label="Internal notes" htmlFor="c-notes"><Textarea id="c-notes" rows={2} {...form.register("routingNotes")} /></Labeled>
          <div className="flex items-center gap-6">
            <Controller control={form.control} name="enabled" render={({ field }) => (
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="switch-city-enabled" /> Show in enquiry form</label>
            )} />
            <label className="flex items-center gap-2 text-sm">Order <Input type="number" className="w-20" {...form.register("sortOrder")} /></label>
          </div>
          <Button type="submit" disabled={save.isPending} data-testid="button-save-city">{save.isPending && <Loader2 className="animate-spin" />} Save city</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManagerDialog({ open, onOpenChange, manager }: { open: boolean; onOpenChange: (o: boolean) => void; manager: CityManager | null }) {
  const form = useForm<ManagerForm>({ resolver: zodResolver(managerInput) });
  useEffect(() => {
    if (open) form.reset(manager ? { name: manager.name, title: manager.title, phone: manager.phone, whatsapp: manager.whatsapp, email: manager.email, active: manager.active } : { name: "", title: "City Manager", phone: "", whatsapp: "", email: "", active: true });
  }, [open, manager, form]);
  const save = useAdminMutation(
    (v: ManagerForm) => (manager ? apiJson("PATCH", `/api/admin/managers/${manager.id}`, v) : apiJson("POST", "/api/admin/managers", v)),
    manager ? "Manager saved" : "Manager added",
    () => onOpenChange(false),
  );
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{manager ? "Edit manager" : "Add manager"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4" data-testid="form-manager">
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Name" htmlFor="m-name" error={errors.name?.message}><Input id="m-name" {...form.register("name")} data-testid="input-manager-name" /></Labeled>
            <Labeled label="Title" htmlFor="m-title"><Input id="m-title" {...form.register("title")} /></Labeled>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="WhatsApp" htmlFor="m-wa" hint="With country code" error={errors.whatsapp?.message}><Input id="m-wa" inputMode="tel" placeholder="9198…" {...form.register("whatsapp")} data-testid="input-manager-whatsapp" /></Labeled>
            <Labeled label="Phone" htmlFor="m-phone" error={errors.phone?.message}><Input id="m-phone" inputMode="tel" {...form.register("phone")} /></Labeled>
          </div>
          <Labeled label="Email" htmlFor="m-email" error={errors.email?.message}><Input id="m-email" type="email" {...form.register("email")} /></Labeled>
          <Controller control={form.control} name="active" render={({ field }) => (
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!field.value} onCheckedChange={field.onChange} /> Active (receives enquiries)</label>
          )} />
          <Button type="submit" disabled={save.isPending} data-testid="button-save-manager">{save.isPending && <Loader2 className="animate-spin" />} Save manager</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Cities() {
  const { data: cities, isLoading } = useQuery<CityWithManager[]>({ queryKey: ["/api/admin/cities"] });
  const { data: managers } = useQuery<CityManager[]>({ queryKey: ["/api/admin/managers"] });
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState<CityWithManager | null>(null);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgr, setMgr] = useState<CityManager | null>(null);
  const toggle = useAdminMutation((v: { id: number; enabled: boolean }) => apiJson("PATCH", `/api/admin/cities/${v.id}`, { enabled: v.enabled }), "City updated");
  const removeCity = useAdminMutation((id: number) => apiJson("DELETE", `/api/admin/cities/${id}`), "City deleted");
  const removeMgr = useAdminMutation((id: number) => apiJson("DELETE", `/api/admin/managers/${id}`), "Manager removed");

  return (
    <>
      <PageHeader
        title="Cities & Routing"
        description="Cities shown in the enquiry form, and who receives each city's enquiries. Changes go live instantly — no rebuild needed."
      />
      <Tabs defaultValue="cities">
        <TabsList>
          <TabsTrigger value="cities" data-testid="tab-cities">Cities</TabsTrigger>
          <TabsTrigger value="managers" data-testid="tab-managers">Managers</TabsTrigger>
        </TabsList>

        <TabsContent value="cities" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setCity(null); setCityOpen(true); }} data-testid="button-add-city"><Plus /> Add city</Button>
          </div>
          <Panel>
            {isLoading ? (
              <div className="p-4 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : !cities?.length ? (
              <EmptyState title="No cities" body="Add the cities you serve. Visitors can always choose “Other”." />
            ) : (
              <ul className="divide-y divide-card-border">
                {cities.map((c) => {
                  const r = routeFor(c);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4" data-testid={`row-city-${c.id}`}>
                      <div className="min-w-[140px]">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.state}</p>
                      </div>
                      <p className="flex-1 text-sm text-muted-foreground flex items-center gap-2 min-w-[200px]">
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span className={cn(!r.ok && "text-[hsl(var(--gold-deep))]")} data-testid={`text-route-${c.id}`}>{r.to}</span>
                      </p>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={c.enabled} onCheckedChange={(v) => toggle.mutate({ id: c.id, enabled: v })} aria-label={`Enable ${c.name}`} data-testid={`switch-city-${c.id}`} />
                        {c.enabled ? "Enabled" : "Disabled"}
                      </label>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => { setCity(c); setCityOpen(true); }} data-testid={`button-edit-city-${c.id}`}><Pencil /></Button>
                      <ConfirmDelete title={`Delete ${c.name}?`} description="Past enquiries keep the city name. Tip: disabling hides it without deleting." onConfirm={() => removeCity.mutate(c.id)} testId={`button-delete-city-${c.id}`} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <p className="mt-3 text-xs text-muted-foreground">Routing order: city override number → assigned active manager → head-office number (Website Content).</p>
        </TabsContent>

        <TabsContent value="managers" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setMgr(null); setMgrOpen(true); }} data-testid="button-add-manager"><Plus /> Add manager</Button>
          </div>
          <Panel>
            {!managers?.length ? (
              <EmptyState title="No managers" body="Add a manager, then assign them to one or more cities." />
            ) : (
              <ul className="divide-y divide-card-border">
                {managers.map((m) => {
                  const assigned = (cities ?? []).filter((c) => c.managerId === m.id).map((c) => c.name);
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 sm:p-4" data-testid={`row-manager-${m.id}`}>
                      <div className="min-w-[180px] flex-1">
                        <p className="font-medium">{m.name} {!m.active && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                        <p className="text-xs text-muted-foreground">{m.title} · WhatsApp {m.whatsapp || "—"}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{assigned.length ? assigned.join(", ") : "No cities"}</p>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => { setMgr(m); setMgrOpen(true); }}><Pencil /></Button>
                      <ConfirmDelete title={`Remove ${m.name}?`} description="Their cities will fall back to the head-office number." onConfirm={() => removeMgr.mutate(m.id)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
      <CityDialog open={cityOpen} onOpenChange={setCityOpen} city={city} managers={managers ?? []} />
      <ManagerDialog open={mgrOpen} onOpenChange={setMgrOpen} manager={mgr} />
    </>
  );
}
