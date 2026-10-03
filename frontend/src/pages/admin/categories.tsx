import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import type { Category } from "@shared/schema";
import { apiJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDelete, EmptyState, PageHeader, Panel, useAdminMutation } from "./ui";

type Row = Category & { projectCount: number };

export default function Categories() {
  const { data, isLoading } = useQuery<Row[]>({ queryKey: ["/api/admin/categories"] });
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string; sortOrder: number } | null>(null);
  const create = useAdminMutation((n: string) => apiJson("POST", "/api/admin/categories", { name: n, sortOrder: data?.length ?? 0 }), "Category added", () => setName(""));
  const save = useAdminMutation((v: { id: number; name: string; sortOrder: number }) => apiJson("PATCH", `/api/admin/categories/${v.id}`, v), "Category saved", () => setEditing(null));
  const remove = useAdminMutation((id: number) => apiJson("DELETE", `/api/admin/categories/${id}`), "Category deleted");

  return (
    <>
      <PageHeader title="Categories" description="Portfolio filters on the Work page. Only categories with published projects are shown to visitors." />
      <Panel className="p-4 mb-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 2) create.mutate(name.trim());
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Pooja Room" maxLength={60} data-testid="input-new-category" />
          <Button type="submit" disabled={name.trim().length < 2 || create.isPending} data-testid="button-add-category">
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
        </form>
      </Panel>
      <Panel>
        {isLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : !data?.length ? (
          <EmptyState title="No categories" body="Add a category to organise your portfolio." />
        ) : (
          <ul className="divide-y divide-card-border">
            {data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-category-${c.id}`}>
                {editing?.id === c.id ? (
                  <>
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="max-w-xs" autoFocus aria-label="Category name" />
                    <Input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className="w-20" aria-label="Order" />
                    <Button size="icon" variant="ghost" aria-label="Save" onClick={() => save.mutate(editing)} data-testid={`button-save-category-${c.id}`}><Check /></Button>
                    <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}><X /></Button>
                  </>
                ) : (
                  <>
                    <span className="font-medium flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.projectCount} project{c.projectCount === 1 ? "" : "s"}</span>
                    <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name, sortOrder: c.sortOrder })} data-testid={`button-edit-category-${c.id}`}><Pencil /></Button>
                    <ConfirmDelete
                      title={`Delete “${c.name}”?`}
                      description={c.projectCount ? "This category still has projects. Move them to another category first." : "Visitors will no longer see this filter."}
                      onConfirm={() => remove.mutate(c.id)}
                      testId={`button-delete-category-${c.id}`}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
