import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import type { Enquiry } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Panel, STATUS_STYLES } from "./ui";
import { cn } from "@/lib/utils";

type Stats = {
  projects: { total: number; published: number; images: number };
  enquiries: { total: number; new: number };
  cities: number;
  services: number;
  recent: Enquiry[];
};

export default function Dashboard() {
  const { admin } = useAuth();
  const { data, isLoading } = useQuery<Stats>({ queryKey: ["/api/admin/stats"] });
  const kpis = data
    ? [
        { label: "New enquiries", value: data.enquiries.new, href: "/enquiries" },
        { label: "Published projects", value: `${data.projects.published}/${data.projects.total}`, href: "/projects" },
        { label: "Portfolio images", value: data.projects.images, href: "/projects" },
        { label: "Cities", value: data.cities, href: "/cities" },
      ]
    : [];
  return (
    <>
      <PageHeader
        title={`Welcome back${admin?.name ? `, ${admin.name}` : ""}`}
        description="Everything visitors see on the website is managed from here."
        actions={
          <Button asChild data-testid="button-new-project">
            <Link href="/projects/new"><Plus /> New project</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : kpis.map((k) => (
              <Link key={k.label} href={k.href} className="block">
                <Panel className="p-5 hover:border-[hsl(var(--gold))] transition-colors">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums" data-testid={`text-kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>{k.value}</p>
                </Panel>
              </Link>
            ))}
      </div>

      <Panel className="mt-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <h2 className="text-sm font-semibold">Latest enquiries</h2>
          <Link href="/enquiries" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : !data?.recent.length ? (
          <EmptyState title="No enquiries yet" body="New consultation requests from the website will appear here." />
        ) : (
          <ul className="divide-y divide-card-border">
            {data.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 text-sm">
                <span className="font-medium min-w-[140px]">{e.name}</span>
                <span className="text-muted-foreground">{e.projectType} · {e.cityName}</span>
                <span className="text-muted-foreground">{e.budget}</span>
                <span className={cn("ml-auto rounded px-2 py-0.5 text-xs capitalize", STATUS_STYLES[e.status])}>{e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
