import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { siteContentSchema, type SiteContent } from "@shared/schema";
import { apiJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Labeled, PageHeader, Panel, SingleImageField, useAdminMutation } from "./ui";

type FormValues = z.input<typeof siteContentSchema>;

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </Panel>
  );
}

export default function Content() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SiteContent>({ queryKey: ["/api/admin/content"] });
  const form = useForm<FormValues>({ resolver: zodResolver(siteContentSchema) });
  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = form;
  const owners = useFieldArray({ control, name: "owners" });
  const pillars = useFieldArray({ control, name: "aboutPillars" });
  const stats = useFieldArray({ control, name: "stats" });

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  const save = useAdminMutation((v: FormValues) => apiJson("PUT", "/api/admin/content", v), "Website content saved");

  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-8 w-60" /><Skeleton className="h-80" /></div>;

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v), () => toast({ title: "Check the highlighted fields", variant: "destructive" }))} noValidate data-testid="form-content">
      <PageHeader
        title="Website Content"
        description="Edit the words and contact details visitors see. Changes appear on the website within a minute."
        actions={<Button type="submit" disabled={!isDirty || save.isPending} data-testid="button-save-content">{save.isPending && <Loader2 className="animate-spin" />} Save changes</Button>}
      />
      <div className="space-y-5">
        <Section title="Contact & WhatsApp" description="The default WhatsApp number receives general chats and enquiries from cities without a manager.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Labeled label="Default WhatsApp (with country code)" htmlFor="wa" error={errors.defaultWhatsapp?.message}><Input id="wa" inputMode="tel" placeholder="9198…" {...register("defaultWhatsapp")} data-testid="input-default-whatsapp" /></Labeled>
            <Labeled label="Phone (display)" htmlFor="ph"><Input id="ph" {...register("phone")} /></Labeled>
            <Labeled label="Email" htmlFor="em" error={errors.email?.message}><Input id="em" type="email" {...register("email")} /></Labeled>
            <Labeled label="Instagram URL" htmlFor="ig"><Input id="ig" {...register("instagram")} /></Labeled>
          </div>
          <Labeled label="Studio address" htmlFor="addr"><Input id="addr" {...register("studioAddress")} /></Labeled>
        </Section>

        <Section title="Hero">
          <Labeled label="Small line above headline" htmlFor="he"><Input id="he" {...register("heroEyebrow")} /></Labeled>
          <Labeled label="Headline" htmlFor="hh" error={errors.heroHeadline?.message}><Input id="hh" {...register("heroHeadline")} data-testid="input-hero-headline" /></Labeled>
          <Labeled label="Supporting statement" htmlFor="hs"><Textarea id="hs" rows={2} {...register("heroSubheadline")} /></Labeled>
          <Controller control={control} name="heroImagePath" render={({ field }) => <SingleImageField label="Hero image (landscape, at least 2000px wide)" value={field.value ?? ""} onChange={field.onChange} />} />
        </Section>

        <Section title="About">
          <Labeled label="Heading" htmlFor="ah"><Input id="ah" {...register("aboutHeading")} /></Labeled>
          <Labeled label="Body" htmlFor="ab"><Textarea id="ab" rows={4} {...register("aboutBody")} /></Labeled>
          <div className="space-y-3">
            <p className="text-sm font-medium">Pillars</p>
            {pillars.fields.map((f, i) => (
              <div key={f.id} className="grid sm:grid-cols-[200px_1fr_auto] gap-2">
                <Input placeholder="Title" {...register(`aboutPillars.${i}.title`)} aria-label="Pillar title" />
                <Input placeholder="Text" {...register(`aboutPillars.${i}.body`)} aria-label="Pillar text" />
                <Button type="button" size="icon" variant="ghost" onClick={() => pillars.remove(i)} aria-label="Remove pillar"><Trash2 /></Button>
              </div>
            ))}
            {pillars.fields.length < 6 && <Button type="button" variant="outline" size="sm" onClick={() => pillars.append({ title: "", body: "" })}><Plus /> Add pillar</Button>}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Highlights</p>
            {stats.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[120px_1fr_auto] gap-2">
                <Input placeholder="120+" {...register(`stats.${i}.value`)} aria-label="Highlight value" />
                <Input placeholder="Homes delivered" {...register(`stats.${i}.label`)} aria-label="Highlight label" />
                <Button type="button" size="icon" variant="ghost" onClick={() => stats.remove(i)} aria-label="Remove highlight"><Trash2 /></Button>
              </div>
            ))}
            {stats.fields.length < 4 && <Button type="button" variant="outline" size="sm" onClick={() => stats.append({ value: "", label: "" })}><Plus /> Add highlight</Button>}
          </div>
        </Section>

        <Section title="Owners" description="Shown in the “People behind the work” section.">
          {owners.fields.map((f, i) => (
            <div key={f.id} className="border border-card-border rounded-md p-4 space-y-3" data-testid={`owner-editor-${i}`}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Labeled label="Name" htmlFor={`on-${i}`} error={errors.owners?.[i]?.name?.message}><Input id={`on-${i}`} {...register(`owners.${i}.name`)} /></Labeled>
                <Labeled label="Role" htmlFor={`or-${i}`} error={errors.owners?.[i]?.role?.message}><Input id={`or-${i}`} {...register(`owners.${i}.role`)} /></Labeled>
              </div>
              <Labeled label="Short bio" htmlFor={`ob-${i}`}><Textarea id={`ob-${i}`} rows={2} {...register(`owners.${i}.bio`)} /></Labeled>
              <Controller
                control={control}
                name={`owners.${i}.focus`}
                render={({ field }) => (
                  <Labeled label="Focus areas" hint="Separate with commas" htmlFor={`of-${i}`}>
                    <Input
                      id={`of-${i}`}
                      defaultValue={(field.value ?? []).join(", ")}
                      onBlur={(e) => field.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6))}
                    />
                  </Labeled>
                )}
              />
              <Controller control={control} name={`owners.${i}.imagePath`} render={({ field }) => <SingleImageField label="Portrait (portrait orientation)" value={field.value ?? ""} onChange={field.onChange} />} />
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => owners.remove(i)}><Trash2 /> Remove owner</Button>
            </div>
          ))}
          {owners.fields.length < 6 && <Button type="button" variant="outline" size="sm" onClick={() => owners.append({ name: "", role: "", bio: "", focus: [], imagePath: "" })}><Plus /> Add owner</Button>}
        </Section>

        <Section title="Closing call-to-action">
          <Labeled label="Headline" htmlFor="ch"><Input id="ch" {...register("ctaHeadline")} /></Labeled>
          <Labeled label="Supporting line" htmlFor="cb"><Input id="cb" {...register("ctaBody")} /></Labeled>
        </Section>
        <input type="hidden" {...register("brandName")} />
        <div className="flex justify-end pb-10">
          <Button type="submit" disabled={!isDirty || save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Save changes</Button>
        </div>
      </div>
    </form>
  );
}
