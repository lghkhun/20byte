"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function ShortlinkManager() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [shortlinks, setShortlinks] = useState<ShortlinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [destinationUrl, setDestinationUrl] = useState("");
  const [campaign, setCampaign] = useState("");
  const [adset, setAdset] = useState("");
  const [ad, setAd] = useState("");

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const canSubmit = useMemo(() => {
    return Boolean(destinationUrl.trim() && !isSubmitting);
  }, [destinationUrl, isSubmitting]);

  const loadOrganizations = useCallback(async () => {
    const response = await fetch("/api/orgs", { cache: "no-store" });
    const payload = (await response.json()) as { data?: { organizations?: OrgItem[] } } & ApiError;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load business.");
    }

    const nextOrgs = payload.data?.organizations ?? [];
    setOrgs(nextOrgs);
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
      await loadShortlinks();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create shortlink."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisableShortlink(shortlinkId: string) {
    try {
      setError(null);

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
    } catch (err) {
      setError(toErrorMessage(err, "Failed to disable shortlink."));
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Shortlink Attribution</h1>
        <p className="text-sm text-muted-foreground">Create CTWA shortlinks and disable links when campaigns stop.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface/70 p-4">
        <p className="mb-2 block text-xs text-muted-foreground">Business</p>
        <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
          {activeBusiness?.name ?? "Primary business"}
        </p>
      </div>

      <form onSubmit={handleCreateShortlink} className="rounded-xl border border-border bg-surface/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Create Shortlink</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
            placeholder="https://wa.me/628123456789"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
            placeholder="Campaign"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={adset}
            onChange={(event) => setAdset(event.target.value)}
            placeholder="Adset"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={ad}
            onChange={(event) => setAd(event.target.value)}
            placeholder="Ad"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Slug is random (7 chars). Canonical format: wa.20byte.com/{"{slug}"}</p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Shortlink"}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-border bg-surface/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Shortlink List</h2>
          <button
            type="button"
            onClick={() => {
              void loadShortlinks();
            }}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        {!isLoading && shortlinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shortlinks created yet.</p>
        ) : null}

        {!isLoading && shortlinks.length > 0 ? (
          <div className="space-y-2">
            {shortlinks.map((shortlink) => (
              <div key={shortlink.id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{shortlink.shortUrl}</p>
                    <p className="text-xs text-muted-foreground">→ {shortlink.destinationUrl}</p>
                    <p className="text-xs text-muted-foreground">
                      Source: {shortlink.source ?? "-"} | Campaign: {shortlink.campaign ?? "-"} | Adset: {shortlink.adset ?? "-"} | Ad: {shortlink.ad ?? shortlink.adName ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        shortlink.isEnabled
                          ? "rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                          : "rounded border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      }
                    >
                      {shortlink.isEnabled ? "ACTIVE" : "DISABLED"}
                    </span>
                    {shortlink.isEnabled ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDisableShortlink(shortlink.id);
                        }}
                        className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300"
                      >
                        Disable
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
