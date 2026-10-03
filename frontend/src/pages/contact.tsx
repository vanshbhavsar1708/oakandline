import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { SiWhatsapp } from "react-icons/si";
import { Check, Loader2, MapPin, Video } from "lucide-react";
import { BUDGET_OPTIONS, TIME_SLOTS, enquiryInput } from "@shared/schema";
import { ApiError, apiJson } from "@/lib/queryClient";
import { useSeo, useSite } from "@/lib/site";
import { SectionLabel } from "@/components/site/primitives";
import { ctaClass } from "@/components/site/cta";
import { cn } from "@/lib/utils";

type FormValues = z.input<typeof enquiryInput>;
type EnquiryResult = { id: number; reference: string; routedTo: string; whatsappUrl: string; message: string };

const fieldBase =
  "w-full bg-transparent border-0 border-b border-[hsl(var(--input))] rounded-none px-0 py-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[hsl(var(--ink))] focus-visible:outline-none transition-colors aria-[invalid=true]:border-destructive";

function Field({ id, label, error, optional, children, className }: { id: string; label: string; error?: string; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="eyebrow text-muted-foreground flex justify-between">
        <span>{label}</span>
        {optional && <span className="normal-case tracking-normal text-xs">Optional</span>}
      </label>
      {children}
      <p id={`${id}-error`} role={error ? "alert" : undefined} className="min-h-[1.25rem] mt-1.5 text-sm text-destructive">
        {error}
      </p>
    </div>
  );
}

function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function Contact() {
  useSeo({
    title: "Discuss Your Project — Book a Consultation",
    description: "Tell us about your home. Choose an online or in-person consultation with the Oak & Line design team.",
  });
  const { data: site, isLoading: siteLoading } = useSite();
  const [result, setResult] = useState<EnquiryResult | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(enquiryInput),
    mode: "onTouched",
    defaultValues: {
      name: "", phone: "", email: "", cityId: "", customCity: "", projectType: "", budget: "",
      preferredDate: "", preferredTime: "", meetingType: undefined as unknown as "online", meetingAddress: "", message: "", website: "",
    },
  });
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = form;
  const cityId = watch("cityId");
  const meetingType = watch("meetingType");
  const preferredTime = watch("preferredTime");

  const projectTypes = useMemo(() => [...(site?.services ?? []).map((s) => s.name), "Something else"], [site]);

  const submit = useMutation({
    mutationFn: (v: FormValues) => apiJson<EnquiryResult>("POST", "/api/enquiries", v),
    onSuccess: (r) => {
      setResult(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([k, m]) => setError(k as keyof FormValues, { message: m }));
      }
    },
  });

  const err = (k: keyof FormValues) => errors[k]?.message as string | undefined;
  const aria = (k: keyof FormValues) => ({ "aria-invalid": !!errors[k], "aria-describedby": `${k}-error` });

  if (result) {
    return (
      <section className="pt-36 md:pt-48 pb-28 md:pb-40">
        <div className="container-x max-w-3xl" data-testid="status-enquiry-success">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-[hsl(var(--gold))] text-gold-deep">
            <Check className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="font-display mt-8 text-5xl md:text-6xl leading-[1.02]">Thank you — we've received your enquiry.</h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Your reference is <strong className="text-foreground" data-testid="text-reference">{result.reference}</strong>. It has been
            routed to <strong className="text-foreground" data-testid="text-routed-to">{result.routedTo}</strong>, who will confirm your
            consultation shortly. For a faster reply, send the details on WhatsApp.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className={ctaClass("solid")} data-testid="link-enquiry-whatsapp">
              <SiWhatsapp className="h-4 w-4" aria-hidden="true" /> Send on WhatsApp
            </a>
            <button type="button" className={ctaClass("outline")} onClick={() => { setResult(null); form.reset(); }} data-testid="button-new-enquiry">
              New enquiry
            </button>
          </div>
          <details className="mt-12 border-t border-border pt-6">
            <summary className="eyebrow cursor-pointer text-muted-foreground">Message preview</summary>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/80" data-testid="text-whatsapp-preview">{result.message}</pre>
          </details>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-36 md:pt-48 pb-28 md:pb-40">
      <div className="container-x grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionLabel>Consultation</SectionLabel>
          <h1 className="font-display mt-6 text-5xl md:text-6xl leading-[1.02]">Discuss your project.</h1>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            A few details help us prepare properly. We'll confirm the slot, bring relevant material samples and give you an honest view on
            scope and budget.
          </p>
          <ol className="mt-10 space-y-5 text-sm">
            {["Share your home & preferred slot", "We confirm with your city's design manager", "Meet online or at your site"].map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="eyebrow tabular-nums text-gold-deep pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit((v) => submit.mutate(v))}
          className="lg:col-span-7 lg:col-start-6 grid gap-x-10 gap-y-4 sm:grid-cols-2"
          aria-busy={submit.isPending}
          data-testid="form-enquiry"
        >
          {/* honeypot */}
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" {...register("website")} />

          <Field id="name" label="Your name" error={err("name")}>
            <input id="name" autoComplete="name" className={fieldBase} placeholder="Full name" {...aria("name")} {...register("name")} data-testid="input-name" />
          </Field>
          <Field id="phone" label="Mobile number" error={err("phone")}>
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" className={fieldBase} placeholder="+91 98xxx xxxxx" {...aria("phone")} {...register("phone")} data-testid="input-phone" />
          </Field>
          <Field id="email" label="Email" optional error={err("email")} className="sm:col-span-2">
            <input id="email" type="email" autoComplete="email" className={fieldBase} placeholder="you@example.com" {...aria("email")} {...register("email")} data-testid="input-email" />
          </Field>

          <Field id="cityId" label="City" error={err("cityId")}>
            <select id="cityId" className={cn(fieldBase, "appearance-none cursor-pointer")} disabled={siteLoading} {...aria("cityId")} {...register("cityId")} data-testid="select-city">
              <option value="">{siteLoading ? "Loading cities…" : "Select city"}</option>
              {(site?.cities ?? []).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </Field>
          {cityId === "other" ? (
            <Field id="customCity" label="Your city" error={err("customCity")}>
              <input id="customCity" className={fieldBase} placeholder="e.g. Rajkot" autoFocus {...aria("customCity")} {...register("customCity")} data-testid="input-custom-city" />
            </Field>
          ) : (
            <div className="hidden sm:block" aria-hidden="true" />
          )}

          <Field id="projectType" label="Project type" error={err("projectType")}>
            <select id="projectType" className={cn(fieldBase, "appearance-none cursor-pointer")} {...aria("projectType")} {...register("projectType")} data-testid="select-project-type">
              <option value="">Select project type</option>
              {projectTypes.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field id="budget" label="Approximate budget" error={err("budget")}>
            <select id="budget" className={cn(fieldBase, "appearance-none cursor-pointer")} {...aria("budget")} {...register("budget")} data-testid="select-budget">
              <option value="">Select a range</option>
              {BUDGET_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>

          <Field id="preferredDate" label="Preferred date" error={err("preferredDate")}>
            <input id="preferredDate" type="date" min={todayIso()} className={fieldBase} {...aria("preferredDate")} {...register("preferredDate")} data-testid="input-date" />
          </Field>
          <Field id="preferredTime" label="Preferred time" error={err("preferredTime")}>
            <select id="preferredTime" className={cn(fieldBase, "appearance-none cursor-pointer")} value={preferredTime} {...aria("preferredTime")} {...register("preferredTime")} data-testid="select-time">
              <option value="">Select a time</option>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <fieldset className="sm:col-span-2 mt-2" aria-describedby="meetingType-error">
            <legend className="eyebrow text-muted-foreground">Meeting type</legend>
            <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup">
              {([
                { v: "online", label: "Online", sub: "Video call", Icon: Video },
                { v: "offline", label: "Offline", sub: "At your site / home", Icon: MapPin },
              ] as const).map(({ v, label, sub, Icon }) => {
                const on = meetingType === v;
                return (
                  <label
                    key={v}
                    className={cn(
                      "flex cursor-pointer items-center gap-4 border p-4 transition-colors",
                      on ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-ivory" : "border-[hsl(var(--input))] hover:border-[hsl(var(--ink))]",
                    )}
                    data-testid={`radio-meeting-${v}`}
                  >
                    <input
                      type="radio"
                      value={v}
                      className="sr-only"
                      checked={on}
                      onChange={() => setValue("meetingType", v, { shouldValidate: true })}
                    />
                    <Icon className={cn("h-5 w-5 shrink-0", on ? "text-gold" : "text-gold-deep")} aria-hidden="true" />
                    <span>
                      <span className="block font-medium">{label}</span>
                      <span className={cn("block text-xs", on ? "text-[hsl(var(--ivory)/0.7)]" : "text-muted-foreground")}>{sub}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p id="meetingType-error" role={errors.meetingType ? "alert" : undefined} className="min-h-[1.25rem] mt-1.5 text-sm text-destructive">
              {err("meetingType")}
            </p>
          </fieldset>

          {meetingType === "offline" && (
            <Field id="meetingAddress" label="Meeting address" error={err("meetingAddress")} className="sm:col-span-2 page-in">
              <textarea id="meetingAddress" rows={2} autoComplete="street-address" className={cn(fieldBase, "resize-none")} placeholder="Flat / house, society, area" {...aria("meetingAddress")} {...register("meetingAddress")} data-testid="input-address" />
            </Field>
          )}

          <Field id="message" label="Tell us about your home" optional error={err("message")} className="sm:col-span-2">
            <textarea id="message" rows={4} className={cn(fieldBase, "resize-none")} placeholder="Rooms, size, possession date, style you like…" {...aria("message")} {...register("message")} data-testid="input-message" />
          </Field>

          {submit.isError && !(submit.error instanceof ApiError && submit.error.fieldErrors) && (
            <p role="alert" className="sm:col-span-2 text-sm text-destructive" data-testid="status-submit-error">
              {(submit.error as Error).message || "Something went wrong. Please try again or message us on WhatsApp."}
            </p>
          )}

          <div className="sm:col-span-2 mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <button type="submit" className={ctaClass("solid", "sm:min-w-[260px]")} disabled={submit.isPending} data-testid="button-submit-enquiry">
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {submit.isPending ? "Sending…" : "Request Consultation"}
            </button>
            <p className="text-xs text-muted-foreground max-w-xs">
              We'll only use your details to arrange this consultation.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
