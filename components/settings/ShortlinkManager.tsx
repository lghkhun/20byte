"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, MoreHorizontal, PauseCircle } from "lucide-react";

import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OperationFeedback } from "@/components/ui/operation-feedback";
import { useSettingsHeaderAction } from "@/components/settings/settings-header-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OrgItem = {
  id: string;
  name: string;
};

type ShortlinkItem = {
  id: string;
  code: string;
  shortUrl: string;
  destinationUrl: string;
  source: string;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  adName: string | null;
  isEnabled: boolean;
  createdAt: string;
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function ShortlinkManager({ variant = "settings" }: { variant?: "settings" | "page" }) {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [shortlinks, setShortlinks] = useState<ShortlinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [destinationUrl, setDestinationUrl] = useState("");
  const [campaign, setCampaign] = useState("");
  const [adset, setAdset] = useState("");
  const [ad, setAd] = useState("");

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const canSubmit = useMemo(() => Boolean(destinationUrl.trim() && !isSubmitting), [destinationUrl, isSubmitting]);
  const createAction = useMemo(
    () => (
      <Button type="button" className="h-10 rounded-xl" onClick={() => setIsCreateDialogOpen(true)}>
        Tambah Shortlink
      </Button>
    ),
    []
  );

  useSettingsHeaderAction("10-shortlink-create", variant === "settings" ? createAction : null);

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadShortlinks = useCallback(async () => {
    const response = await fetch("/api/shortlinks", { cache: "no-store" });
    const payload = (await response.json()) as { data?: { shortlinks?: ShortlinkItem[] } } & ApiError;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load shortlinks.");
    }

    setShortlinks(payload.data?.shortlinks ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        await loadOrganizations();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to initialize shortlink settings."));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [loadOrganizations]);

  useEffect(() => {
    let mounted = true;

    async function syncShortlinks() {
      if (!activeBusiness) {
        return;
      }

      try {
        setError(null);
        await loadShortlinks();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to refresh shortlinks."));
        }
      }
    }

    void syncShortlinks();

    return () => {
      mounted = false;
    };
  }, [activeBusiness, loadShortlinks]);

  async function handleCreateShortlink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/shortlinks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          destinationUrl,
          source: "meta_ads",
          campaign,
          adset,
          ad
        })
      });

      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to create shortlink.");
      }

      setDestinationUrl("");
      setCampaign("");
      setAdset("");
      setAd("");
      setIsCreateDialogOpen(false);
      await loadShortlinks();
      setSuccess("Shortlink created.");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create shortlink."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisableShortlink(shortlinkId: string) {
    try {
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/shortlinks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          shortlinkId
        })
      });

      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to disable shortlink.");
      }

      await loadShortlinks();
      setSuccess("Shortlink disabled.");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to disable shortlink."));
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("Shortlink copied.");
    } catch {
      setError("Failed to copy shortlink.");
    }
  }

  return (
    <section className="space-y-4">
      {variant === "page" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">Shortlink</h1>
            <p className="mt-1 text-sm text-muted-foreground">Kelola shortlink kampanye dan tautan publik dari satu tabel.</p>
          </div>
          <Button type="button" className="h-10 rounded-xl" onClick={() => setIsCreateDialogOpen(true)}>
            Tambah Shortlink
          </Button>
        </div>
      ) : null}
      {error ? <OperationFeedback tone="error" message={error} /> : null}
      {!error && success ? <OperationFeedback tone="success" message={success} /> : null}

      <p className="text-sm text-muted-foreground">Buat CTWA shortlink untuk kampanye dan kelola status link dari satu tabel yang rapi.</p>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Short URL</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  Loading shortlinks...
                </TableCell>
              </TableRow>
            ) : shortlinks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  No shortlinks created yet.
                </TableCell>
              </TableRow>
            ) : (
              shortlinks.map((shortlink) => (
                <TableRow key={shortlink.id}>
                  <TableCell className="font-medium text-foreground">{shortlink.code}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-primary">{shortlink.shortUrl}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">{shortlink.destinationUrl}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.campaign ?? shortlink.ad ?? shortlink.adName ?? "-"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        shortlink.isEnabled
                          ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700"
                          : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {shortlink.isEnabled ? "ACTIVE" : "DISABLED"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateLabel(shortlink.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open shortlink actions</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Shortlink actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => void handleCopy(shortlink.shortUrl)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy short URL
                        </DropdownMenuItem>
                        {shortlink.isEnabled ? (
                          <DropdownMenuItem onClick={() => void handleDisableShortlink(shortlink.id)}>
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Disable
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Tambah Shortlink</DialogTitle>
            <DialogDescription>Buat shortlink CTWA baru untuk campaign aktif.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateShortlink} className="grid gap-3">
            <Input
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
              placeholder="https://wa.me/628123456789"
              className="h-10 rounded-xl"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Campaign" className="h-10 rounded-xl" />
              <Input value={adset} onChange={(event) => setAdset(event.target.value)} placeholder="Adset" className="h-10 rounded-xl" />
            </div>
            <Input value={ad} onChange={(event) => setAd(event.target.value)} placeholder="Ad" className="h-10 rounded-xl" />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? "Creating..." : "Create Shortlink"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
