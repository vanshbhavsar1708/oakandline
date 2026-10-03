import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Phone } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { Enquiry } from "@shared/schema";
import { waLink } from "@shared/whatsapp";
import { apiJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDelete, EmptyState, PageHeader, Panel, STATUS_STYLES, useAdminMutation } from "./ui";
import { cn } from "@/lib/utils";

const STATUSES = ["new", "contacted", "scheduled", "won", "closed"] as const;

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function Enquiries() {
  const [status, setStatus] = useState("all");
  const { data, isLoading } = useQuery<Enquiry[]>({ queryKey: ["/api/admin/enquiries", status === "all" ? {} : { status }] });
  const [openId, setOpenId] = useState<number | null>(null);
  const setS = useAdminMutation((v: { id: number; status: string }) => apiJson("PATCH", `/api/admin/enquiries/${v.id}`, { status: v.status }), "Status updated");
  const remove = useAdminMutation((id: number) => apiJson("DELETE", `/api/admin/enquiries/${id}`), "Enquiry deleted");

  return (
    <>
      <PageHeader title="Enquiries" description="Consultation requests from the website, with the manager each one was routed to." />
      <div className="flex gap-1.5 flex-wrap mb-4" role="tablist" aria-label="Filter by status">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={cn("rounded-full px-3.5 py-1.5 text-xs capitalize border transition-colors", status === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
            data-testid={`filter-status-${s}`}
          >
            {s}
          </button>
        ))}
      </div>
      <Panel>
        {isLoading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !data?.length ? (
          <EmptyState title={status === "all" ? "No enquiries yet" : `No “${status}” enquiries`} body="When visitors submit the consultation form, it shows up here." />
        ) : (
          <ul className="divide-y divide-card-border">
            {data.map((e) => {
              const open = openId === e.id;
              const reply = waLink(e.phone, `Hello ${e.name}, this is Oak & Line regarding your ${e.projectType} enquiry (OL-${e.id}).`);
              return (
                <li key={e.id} data-testid={`row-enquiry-${e.id}`}>
                  <button className="w-full flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3.5 text-left text-sm hover:bg-muted/50" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open}>
                    <span className="font-medium min-w-[140px]">{e.name}</span>
                    <span className="text-muted-foreground">{e.projectType}</span>
                    <span className="text-muted-foreground">{e.cityName}</span>
                    <span className="text-muted-foreground hidden md:inline">{e.budget}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{fmt(e.createdAt)}</span>
                    <span className={cn("rounded px-2 py-0.5 text-xs capitalize", STATUS_STYLES[e.status])}>{e.status}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="px-4 pb-5 grid gap-5 md:grid-cols-[1fr_auto] bg-muted/30">
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm pt-4">
                        {[
                          ["Reference", `OL-${e.id}`],
                          ["Phone", e.phone],
                          ["Email", e.email || "—"],
                          ["Preferred", `${e.preferredDate} · ${e.preferredTime}`],
                          ["Meeting", e.meetingType === "offline" ? "Offline / site visit" : "Online"],
                          ["Routed to", e.routedTo],
                          ...(e.meetingType === "offline" ? [["Address", e.meetingAddress]] : []),
                        ].map(([k, v]) => (
                          <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words">{v}</dd></div>
                        ))}
                        {e.message && <div className="col-span-full"><dt className="text-xs text-muted-foreground">Message</dt><dd className="mt-0.5 whitespace-pre-line">{e.message}</dd></div>}
                      </dl>
                      <div className="flex md:flex-col gap-2 pt-4 flex-wrap">
                        <select value={e.status} onChange={(ev) => setS.mutate({ id: e.id, status: ev.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm capitalize" aria-label="Status" data-testid={`select-status-${e.id}`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Button asChild variant="outline" size="sm"><a href={reply} target="_blank" rel="noopener noreferrer"><SiWhatsapp /> Reply</a></Button>
                        <Button asChild variant="outline" size="sm"><a href={`tel:${e.phone.replace(/\s/g, "")}`}><Phone /> Call</a></Button>
                        <ConfirmDelete title="Delete this enquiry?" description="This can't be undone." onConfirm={() => remove.mutate(e.id)} testId={`button-delete-enquiry-${e.id}`} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
