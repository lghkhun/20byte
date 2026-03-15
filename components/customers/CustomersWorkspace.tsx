"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Tags, Upload, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerTag = {
  id: string;
  name: string;
  color: string;
  customerCount?: number;
};

type CustomerRow = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  conversationCount: number;
  tags: CustomerTag[];
};

type CustomersResponse = {
  data?: {
    customers?: CustomerRow[];
    tags?: CustomerTag[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    message?: string;
  };
};

type TagsResponse = {
  data?: {
    tags?: CustomerTag[];
  };
  error?: {
    message?: string;
  };
};

const LABEL_COLORS = ["emerald", "amber", "sky", "rose", "violet", "slate"];

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toInitial(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || "#";
}

export function CustomersWorkspace() {
  const [activeTab, setActiveTab] = useState<"contacts" | "labels">("contacts");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("emerald");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: String(pageSize)
      });
      if (searchText.trim()) {
        params.set("q", searchText.trim());
      }
      if (selectedTagId) {
        params.set("tagId", selectedTagId);
      }

      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to load customer database.");
        return;
      }

      setCustomers(payload?.data?.customers ?? []);
      setTags(payload?.data?.tags ?? []);
    } catch {
      setError("Network error while loading customer database.");
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, searchText, selectedTagId]);

  const loadTags = useCallback(async () => {
    const response = await fetch("/api/tags", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as TagsResponse | null;
    if (response.ok) {
      setTags(payload?.data?.tags ?? []);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.displayName ?? "", customer.phoneE164].some((value) => value.toLowerCase().includes(query))
    );
  }, [customers, searchText]);

  return (
    <section className="min-h-[calc(100vh-1rem)] rounded-[28px] p-5">
      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-border/70 bg-card/95 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Database</p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                activeTab === "contacts" ? "border-orange-300 bg-orange-50 text-orange-600" : "border-border/80 bg-background/60 text-foreground"
              }`}
            >
              <UsersRound className="h-4 w-4" />
              <span className="text-sm font-semibold">All Contacts</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("labels")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                activeTab === "labels" ? "border-orange-300 bg-orange-50 text-orange-600" : "border-border/80 bg-background/60 text-foreground"
              }`}
            >
              <Tags className="h-4 w-4" />
              <span className="text-sm font-semibold">Label Management</span>
            </button>
          </div>
        </aside>

        <div className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-sm">
          {activeTab === "contacts" ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">Database Kontak</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Total: {customers.length} kontak yang aktif di bisnis Anda.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="gap-2 rounded-xl border border-border/80 bg-background">
                    <span className="text-red-500">◌</span>
                    Logs
                  </Button>
                  <Button type="button" variant="secondary" className="gap-2 rounded-xl border border-border/80 bg-background">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button type="button" variant="secondary" className="gap-2 rounded-xl border border-border/80 bg-background">
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                  <Button type="button" className="gap-2 rounded-xl" onClick={() => setIsCreateContactOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Tambah Kontak
                  </Button>
                </div>
              </div>

              <div className="mt-6 rounded-[22px] border border-border/70 bg-background/50">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4">
                  <label className="relative block w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Cari nama atau nomor..."
                      className="h-11 rounded-xl border-border/80 bg-background pl-10"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value={10}>10 Baris</option>
                      <option value={20}>20 Baris</option>
                      <option value={50}>50 Baris</option>
                    </select>
                    <select
                      value={selectedTagId}
                      onChange={(event) => setSelectedTagId(event.target.value)}
                      className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value="">Filter Label</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 py-4">Nama</th>
                        <th className="px-4 py-4">WhatsApp</th>
                        <th className="px-4 py-4">Ditambahkan pada</th>
                        <th className="px-4 py-4">Percakapan</th>
                        <th className="px-4 py-4">Labels</th>
                        <th className="px-4 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-border/60 align-top">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {customer.avatarUrl ? (
                                <div className="relative h-9 w-9 overflow-hidden rounded-full border border-border/70">
                                  <Image src={customer.avatarUrl} alt={customer.displayName ?? customer.phoneE164} fill unoptimized className="object-cover" />
                                </div>
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {toInitial(customer.displayName ?? customer.phoneE164)}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-semibold text-foreground">{customer.displayName?.trim() || customer.phoneE164}</p>
                                <p className="text-xs text-muted-foreground">{customer.phoneE164}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{customer.phoneE164}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{formatDateLabel(customer.createdAt)}</td>
                          <td className="px-4 py-4">
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                              {customer.conversationCount} chat
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              {customer.tags.length === 0 ? <span className="text-sm text-muted-foreground">-</span> : null}
                              {customer.tags.map((tag) => (
                                <span key={tag.id} className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end">
                              <select
                                className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
                                defaultValue=""
                                onChange={async (event) => {
                                  const tagId = event.target.value;
                                  if (!tagId) {
                                    return;
                                  }

                                  await fetch(`/api/customers/${encodeURIComponent(customer.id)}/tags`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ tagId })
                                  });
                                  event.currentTarget.value = "";
                                  await loadCustomers();
                                }}
                              >
                                <option value="">Assign label</option>
                                {tags.map((tag) => (
                                  <option key={tag.id} value={tag.id}>
                                    {tag.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isLoading ? <p className="px-4 py-5 text-sm text-muted-foreground">Loading customers...</p> : null}
                {error ? <p className="px-4 py-5 text-sm text-destructive">{error}</p> : null}
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Label Management</h1>
                <p className="mt-1 text-sm text-muted-foreground">Kelola label customer untuk segmentasi, routing, dan follow-up.</p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-[22px] border border-border/70 bg-background/60 p-4">
                  <h2 className="text-sm font-semibold text-foreground">Create New Label</h2>
                  <div className="mt-4 space-y-3">
                    <Input value={labelName} onChange={(event) => setLabelName(event.target.value)} placeholder="Label name" className="h-11 rounded-xl" />
                    <select value={labelColor} onChange={(event) => setLabelColor(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      {LABEL_COLORS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      className="w-full rounded-xl"
                      disabled={!labelName.trim() || isCreatingLabel}
                      onClick={async () => {
                        setIsCreatingLabel(true);
                        try {
                          await fetch("/api/tags", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: labelName.trim(), color: labelColor })
                          });
                          setLabelName("");
                          await loadTags();
                          await loadCustomers();
                        } finally {
                          setIsCreatingLabel(false);
                        }
                      }}
                    >
                      {isCreatingLabel ? "Creating..." : "Create Label"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/70 bg-background/60 p-4">
                  <h2 className="text-sm font-semibold text-foreground">Existing Labels</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {tags.map((tag) => (
                      <article key={tag.id} className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{tag.name}</p>
                            <p className="text-xs text-muted-foreground">{tag.customerCount ?? 0} contacts</p>
                          </div>
                          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">{tag.color}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCreateContactOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Tambah Kontak</h3>
                <p className="text-sm text-muted-foreground">Simpan customer baru ke database kontak bisnis.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setIsCreateContactOpen(false)}>
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input value={newContactName} onChange={(event) => setNewContactName(event.target.value)} placeholder="Nama customer" className="h-11 rounded-xl" />
              <Input value={newContactPhone} onChange={(event) => setNewContactPhone(event.target.value)} placeholder="Nomor WhatsApp (+628...)" className="h-11 rounded-xl" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateContactOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!newContactPhone.trim() || isCreatingContact}
                onClick={async () => {
                  setIsCreatingContact(true);
                  try {
                    await fetch("/api/customers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: newContactName.trim(),
                        phoneE164: newContactPhone.trim()
                      })
                    });
                    setNewContactName("");
                    setNewContactPhone("");
                    setIsCreateContactOpen(false);
                    await loadCustomers();
                  } finally {
                    setIsCreatingContact(false);
                  }
                }}
              >
                {isCreatingContact ? "Saving..." : "Save Contact"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
