import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { ApiError, imageUrl, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/supabase-upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-card border border-card-border rounded-md", className)}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="py-16 px-6 text-center" data-testid="status-empty">
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-1 text-xs text-destructive">{message}</p>;
}

export function Labeled({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

/** Mutation helper: toasts + invalidates every cached query (public + admin) so the site stays in sync. */
export function useAdminMutation<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, success?: string, onDone?: (r: TRes) => void) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      queryClient.invalidateQueries();
      if (success) toast({ title: success });
      onDone?.(r);
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't save", description: e instanceof ApiError ? e.message : "Please try again.", variant: "destructive" });
    },
  });
}

export function ConfirmDelete({
  title,
  description,
  onConfirm,
  trigger,
  testId,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  trigger?: ReactNode;
  testId?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label={title} data-testid={testId}>
            <Trash2 className="text-destructive" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={onConfirm} data-testid="button-confirm-delete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const MAX_MB = 15;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

export function validateFiles(files: File[]): { ok: File[]; rejected: string[] } {
  const ok: File[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) rejected.push(`${f.name}: not an image`);
    else if (f.size > MAX_MB * 1024 * 1024) rejected.push(`${f.name}: larger than ${MAX_MB} MB`);
    else ok.push(f);
  }
  return { ok, rejected };
}

/** Drop-zone used for project galleries (multiple) — shows local previews + upload progress. */
export function DropZone({
  multiple = true,
  onFiles,
  busy,
  progress,
  label = "Drop photos here or click to browse",
}: {
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  busy?: boolean;
  progress?: number;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative border border-dashed rounded-md px-6 py-10 text-center transition-colors",
        over ? "border-[hsl(var(--gold-deep))] bg-[hsl(var(--accent))]" : "border-[hsl(var(--input))]",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        data-testid="input-file"
      />
      {busy ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm">Uploading & optimising… {progress ?? 0}%</p>
          <div className="h-1 w-48 bg-muted rounded overflow-hidden">
            <div className="h-full bg-[hsl(var(--gold-deep))] transition-all" style={{ width: `${progress ?? 0}%` }} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="flex flex-col items-center gap-2 w-full" data-testid="button-browse-files">
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG, WebP or HEIC · up to {MAX_MB} MB each{multiple ? " · up to 20 at once" : ""}. Images are compressed automatically.
          </span>
        </button>
      )}
    </div>
  );
}

/** Single image field (services, hero, owners). Stores a basePath string. */
export function SingleImageField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const handle = async (files: File[]) => {
    const { ok, rejected } = validateFiles(files.slice(0, 1));
    if (rejected.length) return toast({ title: "Image not accepted", description: rejected[0], variant: "destructive" });
    if (!ok.length) return;
    const fd = new FormData();
    fd.append("image", ok[0]);
    setBusy(true);
    try {
      const res = await apiUpload<{ basePath: string }>("/api/admin/uploads", fd, setPct);
      onChange(res.basePath);
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-sm bg-muted">
          {value && <img src={imageUrl(value, 640)} alt="" className="h-full w-full object-cover" />}
        </div>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { handle(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy} data-testid="button-upload-single">
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {busy ? `${pct}%` : value ? "Replace image" : "Upload image"}
        </Button>
      </div>
    </div>
  );
}

export const STATUS_STYLES: Record<string, string> = {
  new: "bg-[hsl(var(--gold)/0.18)] text-[hsl(var(--gold-deep))]",
  contacted: "bg-blue-500/10 text-blue-700",
  scheduled: "bg-violet-500/10 text-violet-700",
  won: "bg-emerald-500/10 text-emerald-700",
  closed: "bg-muted text-muted-foreground",
};
