"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CatalogItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  priceCents: number | null;
  currency: string;
};

type CatalogResponse = {
  data?: {
    items?: CatalogItem[];
    item?: CatalogItem;
    deleted?: boolean;
  };
  error?: {
    message?: string;
  };
};

type CatalogDraft = {
  name: string;
  category: string;
  unit: string;
  priceCents: string;
};

type ServiceCatalogPanelProps = {
  orgId: string | null;
  onUseItem: (item: { name: string; unit?: string; priceCents: number }) => void;
};

function createEmptyDraft(): CatalogDraft {
  return {
    name: "",
    category: "",
    unit: "",
    priceCents: ""
  };
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

export function ServiceCatalogPanel({ orgId, onUseItem }: ServiceCatalogPanelProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogDraft>(createEmptyDraft);
  const [createDraft, setCreateDraft] = useState<CatalogDraft>(createEmptyDraft);
  const [error, setError] = useState<string | null>(null);

  const editableItem = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);

  const loadItems = useCallback(async () => {
    if (!orgId) {
      setItems([]);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ orgId });
      if (search.trim()) {
        query.set("q", search.trim());
      }

      const response = await fetch(`/api/catalog?${query.toString()}`);
      const body = (await response.json().catch(() => null)) as CatalogResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to load service catalog.");
        return;
      }

      setItems(body?.data?.items ?? []);
    } catch {
      setError("Network error while loading service catalog.");
    } finally {
      setIsLoading(false);
    }
  }, [orgId, search]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      category: item.category ?? "",
      unit: item.unit ?? "",
      priceCents: String(item.priceCents ?? 0)
    });
  }

  async function handleCreate() {
    if (!orgId || isCreating) {
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId,
          name: createDraft.name,
          category: createDraft.category || undefined,
          unit: createDraft.unit || undefined,
          priceCents: Number(createDraft.priceCents)
        })
      });

      const body = (await response.json().catch(() => null)) as CatalogResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to create service catalog item.");
        return;
      }

      setCreateDraft(createEmptyDraft());
      await loadItems();
    } catch {
      setError("Network error while creating service catalog item.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!orgId || !editingId || isSaving) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/catalog/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId,
          name: draft.name,
          category: draft.category || "",
          unit: draft.unit || "",
          priceCents: Number(draft.priceCents)
        })
      });

      const body = (await response.json().catch(() => null)) as CatalogResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to update service catalog item.");
        return;
      }

      setEditingId(null);
      await loadItems();
    } catch {
      setError("Network error while updating service catalog item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!orgId) {
      return;
    }

    setError(null);
    try {
      const params = new URLSearchParams({ orgId });
      const response = await fetch(`/api/catalog/${encodeURIComponent(itemId)}?${params.toString()}`, {
        method: "DELETE"
      });

      const body = (await response.json().catch(() => null)) as CatalogResponse | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to delete service catalog item.");
        return;
      }

      await loadItems();
    } catch {
      setError("Network error while deleting service catalog item.");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-background/40 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Service Catalog</p>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            placeholder="Search catalog"
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-40"
          />
          <Button type="button" variant="secondary" onClick={() => void loadItems()} disabled={isLoading || !orgId}>
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border p-2">
        <p className="mb-2 text-xs text-muted-foreground">Create Item</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            value={createDraft.name}
            placeholder="Name"
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            value={createDraft.category}
            placeholder="Category"
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, category: event.target.value }))}
          />
          <Input
            value={createDraft.unit}
            placeholder="Unit"
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, unit: event.target.value }))}
          />
          <Input
            type="number"
            min={0}
            value={createDraft.priceCents}
            placeholder="Price (IDR)"
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, priceCents: event.target.value }))}
          />
        </div>
        <div className="mt-2">
          <Button type="button" onClick={() => void handleCreate()} disabled={!orgId || isCreating}>
            {isCreating ? "Creating..." : "Add Catalog Item"}
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-xs text-muted-foreground">No catalog items yet.</p> : null}
        {items.map((item) => {
          const isEditingThis = editableItem?.id === item.id;
          if (isEditingThis) {
            return (
              <article key={item.id} className="rounded-md border border-border p-2">
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
                  <Input
                    value={draft.category}
                    onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
                  />
                  <Input value={draft.unit} onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))} />
                  <Input
                    type="number"
                    min={0}
                    value={draft.priceCents}
                    onChange={(event) => setDraft((prev) => ({ ...prev, priceCents: event.target.value }))}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void handleSaveEdit()} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </article>
            );
          }

          return (
            <article key={item.id} className="rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.category ?? "General"} • {item.unit ?? "unit"} • {formatRupiah(item.priceCents ?? 0)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onUseItem({ name: item.name, unit: item.unit ?? undefined, priceCents: item.priceCents ?? 0 })}
                  >
                    Use in Invoice
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => startEdit(item)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void handleDelete(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
