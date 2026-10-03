import { asset } from "@/lib/queryClient";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  ExternalLink,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PenSquare,
  Sofa,
  Tags,
  X,
} from "lucide-react";
import { loginInput } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { localHref, useSeo } from "@/lib/site";
import { Logo } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "./ui";
import { cn } from "@/lib/utils";

const Dashboard = lazy(() => import("./dashboard"));
const ProjectsList = lazy(() => import("./projects").then((m) => ({ default: m.ProjectsList })));
const ProjectEditor = lazy(() => import("./projects").then((m) => ({ default: m.ProjectEditor })));
const Services = lazy(() => import("./services"));
const Categories = lazy(() => import("./categories"));
const Cities = lazy(() => import("./cities"));
const Enquiries = lazy(() => import("./enquiries"));
const Content = lazy(() => import("./content"));

function Login() {
  const { login, expired } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginInput>>({ resolver: zodResolver(loginInput), defaultValues: { email: "", password: "" } });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await login(v.email, v.password);
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:block relative bg-ink">
        <img src={asset("./images/svc-living-1280.webp")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--ink))] to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-ivory">
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm text-[hsl(var(--ivory)/0.7)]">Studio dashboard — manage projects, services, cities and enquiries.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-5" data-testid="form-login">
          <div className="lg:hidden mb-8"><Logo /></div>
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Studio team access only.</p>
          </div>
          {expired && <p className="text-sm text-[hsl(var(--gold-deep))]" role="status">Your session ended. Please sign in again.</p>}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input id="email" type="email" autoComplete="username" {...form.register("email")} data-testid="input-admin-email" />
            <FieldError message={form.formState.errors.email?.message} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} data-testid="input-admin-password" />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive" data-testid="status-login-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting} data-testid="button-login">
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Sign in
          </Button>
          <a href={localHref("/")} className="block text-center text-xs text-muted-foreground hover:text-foreground">← Back to website</a>
        </form>
      </div>
    </div>
  );
}

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/services", label: "Services", icon: Sofa },
  { href: "/cities", label: "Cities & Routing", icon: Building2 },
  { href: "/content", label: "Website Content", icon: PenSquare },
];

function Shell({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location]);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Admin">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
            data-testid={`link-admin-${label.toLowerCase().replace(/\W+/g, "-")}`}
          >
            <Icon className={cn("h-4 w-4", active && "text-[hsl(var(--gold))]")} /> {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
      <a href={localHref("/")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground">
        <ExternalLink className="h-4 w-4" /> View website
      </a>
      <button onClick={logout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground" data-testid="button-logout">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
      <p className="px-3 pt-2 text-xs text-sidebar-foreground/40 truncate">{admin?.email}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:flex sticky top-0 h-screen flex-col gap-8 bg-sidebar text-sidebar-foreground p-5">
        <Logo tone="light" className="px-2 pt-1" />
        {nav}
        {footer}
      </aside>

      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar text-sidebar-foreground px-4">
        <Logo tone="light" />
        <button onClick={() => setOpen(true)} aria-label="Open admin menu" className="grid h-10 w-10 place-items-center" data-testid="button-admin-menu"><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="flex w-72 flex-col gap-8 bg-sidebar text-sidebar-foreground p-5">
            <div className="flex items-center justify-between">
              <Logo tone="light" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center"><X className="h-5 w-5" /></button>
            </div>
            {nav}
            {footer}
          </div>
          <button className="flex-1 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10 max-w-[1200px] w-full">{children}</main>
    </div>
  );
}

export default function AdminApp() {
  const { admin } = useAuth();
  useSeo({ title: "Studio Admin" });
  useEffect(() => {
    let tag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "robots";
      document.head.appendChild(tag);
    }
    tag.content = "noindex, nofollow";
    return () => tag?.remove();
  }, []);

  if (!admin) return <Login />;
  return (
    <Shell>
      <Suspense fallback={<div className="py-20 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/projects" component={ProjectsList} />
          <Route path="/projects/new">{() => <ProjectEditor id={null} />}</Route>
          <Route path="/projects/:id">{(p) => <ProjectEditor id={Number(p.id)} />}</Route>
          <Route path="/categories" component={Categories} />
          <Route path="/services" component={Services} />
          <Route path="/cities" component={Cities} />
          <Route path="/enquiries" component={Enquiries} />
          <Route path="/content" component={Content} />
          <Route><p className="text-muted-foreground">Page not found.</p></Route>
        </Switch>
      </Suspense>
    </Shell>
  );
}
