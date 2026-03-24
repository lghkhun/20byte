"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
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
import { useSettingsHeaderAction } from "@/components/settings/settings-header-actions";
import { Switch } from "@/components/ui/switch";
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
  waPhone: string | null;
  templateMessage: string | null;
  source: string;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  adName: string | null;
  platform: string | null;
  medium: string | null;
  isEnabled: boolean;
  createdAt: string;
  visitorCount: number;
};

type BaileysConnectionPayload = {
  data?: {
    connection?: {
      connectedAccount?: {
        displayPhone?: string | null;
      } | null;
    } | null;
  };
} & ApiError;

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ShortlinkMutationResponse = {
  data?: {
    shortlink?: ShortlinkItem;
  };
} & ApiError;

type ShortlinksCacheEntry = {
  rows: ShortlinkItem[];
  cachedAt: number;
};

type ConnectionCacheEntry = {
  phone: string;
  cachedAt: number;
};

const SHORTLINKS_CACHE_TTL_MS = 30_000;
const CONNECTION_CACHE_TTL_MS = 60_000;
const SHORTLINKS_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});
const PERF_STORAGE_KEY = "perf.shortlinks.v1";
const PERF_MAX_SAMPLES = 120;

type PerfMetricName =
  | "shortlinks.load"
  | "shortlinks.connection.load"
  | "shortlinks.create"
  | "shortlinks.update"
  | "shortlinks.toggle"
  | "shortlinks.delete";

type PerfSample = {
  name: PerfMetricName;
  durationMs: number;
  ok: boolean;
  at: number;
};

function savePerfSample(sample: PerfSample) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(PERF_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PerfSample[]) : [];
    const next = [...parsed, sample].slice(-PERF_MAX_SAMPLES);
    window.localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore telemetry write failures to keep UX path fast.
  }
}

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

  return SHORTLINKS_DATE_FORMATTER.format(date);
}

export function ShortlinkManager({ variant = "settings" }: { variant?: "settings" | "page" }) {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [hasLoadedOrganizations, setHasLoadedOrganizations] = useState(false);
  const [shortlinks, setShortlinks] = useState<ShortlinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShortlinkId, setEditingShortlinkId] = useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = useState("");
  const [runtimeOrigin, setRuntimeOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [templateMessage, setTemplateMessage] = useState("");
  const [source, setSource] = useState("meta_ads");
  const [campaign, setCampaign] = useState("");
  const [adset, setAdset] = useState("");
  const [adName, setAdName] = useState("");
  const [platform, setPlatform] = useState("meta");
  const [medium, setMedium] = useState("paid_social");
  const [editTemplateMessage, setEditTemplateMessage] = useState("");
  const [editSource, setEditSource] = useState("meta_ads");
  const [editCampaign, setEditCampaign] = useState("");
  const [editAdset, setEditAdset] = useState("");
  const [editAdName, setEditAdName] = useState("");
  const [editPlatform, setEditPlatform] = useState("meta");
  const [editMedium, setEditMedium] = useState("paid_social");
  const shortlinksCacheRef = useRef<Map<string, ShortlinksCacheEntry>>(new Map());
  const connectionCacheRef = useRef<Map<string, ConnectionCacheEntry>>(new Map());
  const hasPrimedShortlinksRef = useRef<Set<string>>(new Set());
  const shortlinksRequestIdRef = useRef(0);
  const connectionRequestIdRef = useRef(0);
  const shortlinksInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const connectionInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const shortlinksAbortControllerRef = useRef<AbortController | null>(null);
  const connectionAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const recordPerf = useCallback((name: PerfMetricName, startedAt: number, ok: boolean) => {
    const durationMs = Number((performance.now() - startedAt).toFixed(1));
    savePerfSample({
      name,
      durationMs,
      ok,
      at: Date.now()
    });
  }, []);

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const normalizedConnectedPhone = useMemo(() => connectedPhone.replace(/\D/g, ""), [connectedPhone]);
  const destinationPreview = useMemo(() => {
    if (!normalizedConnectedPhone) {
      return "-";
    }

    if (!templateMessage.trim()) {
      return `https://wa.me/${normalizedConnectedPhone}`;
    }

    return `https://wa.me/${normalizedConnectedPhone}?text=${encodeURIComponent(templateMessage.trim())}`;
  }, [normalizedConnectedPhone, templateMessage]);
  const canSubmit = useMemo(
    () => Boolean(campaign.trim() && normalizedConnectedPhone && !isSubmitting),
    [campaign, normalizedConnectedPhone, isSubmitting]
  );
  const canOpenPreview = useMemo(() => destinationPreview !== "-", [destinationPreview]);
  const editingShortlink = useMemo(
    () => shortlinks.find((item) => item.id === editingShortlinkId) ?? null,
    [shortlinks, editingShortlinkId]
  );
  const editDestinationPreview = useMemo(() => {
    const waPhone = (editingShortlink?.waPhone ?? normalizedConnectedPhone) || "";
    if (!waPhone) {
      return "-";
    }
    const normalizedMessage = editTemplateMessage.trim();
    if (!normalizedMessage) {
      return `https://wa.me/${waPhone}`;
    }
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(normalizedMessage)}`;
  }, [editTemplateMessage, editingShortlink?.waPhone, normalizedConnectedPhone]);
  const canSaveEdit = useMemo(() => Boolean(editingShortlinkId && editCampaign.trim() && !isMutating), [editingShortlinkId, editCampaign, isMutating]);
  const updateShortlinksState = useCallback(
    (orgId: string, rowsOrUpdater: ShortlinkItem[] | ((rows: ShortlinkItem[]) => ShortlinkItem[])) => {
      setShortlinks((currentRows) => {
        const nextRows = typeof rowsOrUpdater === "function" ? rowsOrUpdater(currentRows) : rowsOrUpdater;
        shortlinksCacheRef.current.set(orgId, {
          rows: nextRows,
          cachedAt: Date.now()
        });
        return nextRows;
      });
    },
    []
  );

  const loadOrganizations = useCallback(async () => {
    try {
      const organizations = (await fetchOrganizationsCached()) as OrgItem[];
      setOrgs(organizations);
    } finally {
      setHasLoadedOrganizations(true);
    }
  }, []);

  const loadShortlinks = useCallback(async (options?: { force?: boolean }) => {
    const orgId = activeBusiness?.id ?? "";
    if (!orgId || !isMountedRef.current) {
      return;
    }
    const startedAt = performance.now();
    const requestId = ++shortlinksRequestIdRef.current;
    if (!options?.force && shortlinksInFlightRef.current?.key === orgId) {
      await shortlinksInFlightRef.current.promise;
      return;
    }
    const cached = shortlinksCacheRef.current.get(orgId);
    if (cached) {
      setShortlinks(cached.rows);
    } else {
      setShortlinks([]);
    }
    const isCacheFresh = Boolean(cached && Date.now() - cached.cachedAt < SHORTLINKS_CACHE_TTL_MS);
    if (isCacheFresh && !options?.force) {
      recordPerf("shortlinks.load", startedAt, true);
      return;
    }

    if (!cached) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    const fetchPromise = (async () => {
      const abortController = new AbortController();
      shortlinksAbortControllerRef.current?.abort();
      shortlinksAbortControllerRef.current = abortController;
      try {
        const response = await fetch(`/api/shortlinks?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store", signal: abortController.signal });
        const payload = (await response.json()) as { data?: { shortlinks?: ShortlinkItem[] } } & ApiError;
        if (!isMountedRef.current || requestId !== shortlinksRequestIdRef.current) {
          return;
        }

        if (!response.ok) {
          recordPerf("shortlinks.load", startedAt, false);
          throw new Error(payload.error?.message ?? "Failed to load shortlinks.");
        }

        const rows = payload.data?.shortlinks ?? [];
        shortlinksCacheRef.current.set(orgId, {
          rows,
          cachedAt: Date.now()
        });
        setShortlinks(rows);
        recordPerf("shortlinks.load", startedAt, true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        throw error;
      } finally {
        if (shortlinksAbortControllerRef.current === abortController) {
          shortlinksAbortControllerRef.current = null;
        }
      }
    })().finally(() => {
      if (shortlinksInFlightRef.current?.key === orgId) {
        shortlinksInFlightRef.current = null;
      }
    });

    shortlinksInFlightRef.current = {
      key: orgId,
      promise: fetchPromise
    };
    await fetchPromise;
  }, [activeBusiness?.id, recordPerf]);

  const loadBaileysConnection = useCallback(async (options?: { force?: boolean }) => {
    const orgId = activeBusiness?.id ?? "";
    if (!orgId || !isMountedRef.current) {
      return;
    }
    const startedAt = performance.now();
    const requestId = ++connectionRequestIdRef.current;

    if (!options?.force && connectionInFlightRef.current?.key === orgId) {
      await connectionInFlightRef.current.promise;
      return;
    }
    const cached = connectionCacheRef.current.get(orgId);
    if (cached) {
      setConnectedPhone(cached.phone);
    }
    const isCacheFresh = Boolean(cached && Date.now() - cached.cachedAt < CONNECTION_CACHE_TTL_MS);
    if (isCacheFresh && !options?.force) {
      recordPerf("shortlinks.connection.load", startedAt, true);
      return;
    }

    const fetchPromise = (async () => {
      const abortController = new AbortController();
      connectionAbortControllerRef.current?.abort();
      connectionAbortControllerRef.current = abortController;
      try {
        const response = await fetch(`/api/whatsapp/baileys?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store", signal: abortController.signal });
        const payload = (await response.json()) as BaileysConnectionPayload;
        if (!isMountedRef.current || requestId !== connectionRequestIdRef.current) {
          return;
        }
        if (!response.ok) {
          recordPerf("shortlinks.connection.load", startedAt, false);
          throw new Error(payload.error?.message ?? "Failed to load connected WhatsApp number.");
        }

        const phone = payload.data?.connection?.connectedAccount?.displayPhone?.trim() ?? "";
        connectionCacheRef.current.set(orgId, {
          phone,
          cachedAt: Date.now()
        });
        setConnectedPhone(phone);
        recordPerf("shortlinks.connection.load", startedAt, true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        throw error;
      } finally {
        if (connectionAbortControllerRef.current === abortController) {
          connectionAbortControllerRef.current = null;
        }
      }
    })().finally(() => {
      if (connectionInFlightRef.current?.key === orgId) {
        connectionInFlightRef.current = null;
      }
    });

    connectionInFlightRef.current = {
      key: orgId,
      promise: fetchPromise
    };
    await fetchPromise;
  }, [activeBusiness?.id, recordPerf]);

  const createAction = useMemo(
    () => (
      <Button
        type="button"
        className="h-10 rounded-xl"
        onMouseEnter={() => {
          void loadShortlinks();
        }}
        onFocus={() => {
          void loadShortlinks();
        }}
        onClick={() => setIsCreateDialogOpen(true)}
      >
        Tambah Shortlink
      </Button>
    ),
    [loadShortlinks]
  );

  useSettingsHeaderAction("10-shortlink-create", variant === "settings" ? createAction : null);

  useEffect(() => {
    setRuntimeOrigin(window.location.origin);
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
      const orgId = activeBusiness?.id ?? "";
      if (!hasLoadedOrganizations) {
        return;
      }
      if (!orgId) {
        if (mounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
        return;
      }

      try {
        setError(null);
        await Promise.all([loadShortlinks(), loadBaileysConnection()]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (mounted) {
          setError(toErrorMessage(err, "Failed to refresh shortlinks."));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void syncShortlinks();

    return () => {
      mounted = false;
    };
  }, [activeBusiness, hasLoadedOrganizations, loadBaileysConnection, loadShortlinks]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      shortlinksAbortControllerRef.current?.abort();
      connectionAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedOrganizations) {
      return;
    }
    const orgId = activeBusiness?.id ?? "";
    if (!orgId) {
      return;
    }
    if (hasPrimedShortlinksRef.current.has(orgId) || shortlinksCacheRef.current.has(orgId)) {
      return;
    }
    hasPrimedShortlinksRef.current.add(orgId);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const runPrefetch = () => {
      void Promise.all([loadShortlinks(), loadBaileysConnection()]);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
    } else {
      timeoutId = globalThis.setTimeout(runPrefetch, 600);
    }

    return () => {
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [activeBusiness?.id, hasLoadedOrganizations, loadBaileysConnection, loadShortlinks]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    notifySuccess(success);
  }, [success]);

  async function handleCreateShortlink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const startedAt = performance.now();

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
          orgId: activeBusiness?.id ?? "",
          source,
          campaign,
          adset,
          adName,
          platform,
          medium,
          templateMessage
        })
      });

      const payload = (await response.json()) as ShortlinkMutationResponse;
      if (!response.ok) {
        recordPerf("shortlinks.create", startedAt, false);
        throw new Error(payload.error?.message ?? "Failed to create shortlink.");
      }

      setTemplateMessage("");
      setSource("meta_ads");
      setCampaign("");
      setAdset("");
      setAdName("");
      setPlatform("meta");
      setMedium("paid_social");
      setIsCreateDialogOpen(false);
      if (activeBusiness?.id && payload.data?.shortlink) {
        updateShortlinksState(activeBusiness.id, (currentRows) => [payload.data!.shortlink!, ...currentRows]);
      } else {
        await loadShortlinks({ force: true });
      }
      setSuccess("Shortlink created.");
      recordPerf("shortlinks.create", startedAt, true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create shortlink."));
      recordPerf("shortlinks.create", startedAt, false);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditDialog(shortlink: ShortlinkItem) {
    setEditingShortlinkId(shortlink.id);
    setEditCampaign(shortlink.campaign ?? "");
    setEditTemplateMessage(shortlink.templateMessage ?? "");
    setEditSource(shortlink.source || "meta_ads");
    setEditAdset(shortlink.adset ?? "");
    setEditAdName(shortlink.adName ?? shortlink.ad ?? "");
    setEditPlatform(shortlink.platform ?? "meta");
    setEditMedium(shortlink.medium ?? "paid_social");
    setIsEditDialogOpen(true);
  }

  async function handleToggleShortlink(shortlinkId: string, isEnabled: boolean) {
    const startedAt = performance.now();
    try {
      setIsMutating(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/shortlinks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness?.id ?? "",
          shortlinkId,
          isEnabled
        })
      });

      const payload = (await response.json()) as ShortlinkMutationResponse;
      if (!response.ok) {
        recordPerf("shortlinks.toggle", startedAt, false);
        throw new Error(payload.error?.message ?? "Failed to update shortlink status.");
      }

      if (activeBusiness?.id && payload.data?.shortlink) {
        updateShortlinksState(activeBusiness.id, (currentRows) =>
          currentRows.map((item) => (item.id === shortlinkId ? payload.data!.shortlink! : item))
        );
      } else {
        await loadShortlinks({ force: true });
      }
      setSuccess(isEnabled ? "Shortlink enabled." : "Shortlink disabled.");
      recordPerf("shortlinks.toggle", startedAt, true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update shortlink status."));
      recordPerf("shortlinks.toggle", startedAt, false);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSaveEditShortlink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingShortlinkId) {
      return;
    }
    const startedAt = performance.now();

    try {
      setIsMutating(true);
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/shortlinks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness?.id ?? "",
          shortlinkId: editingShortlinkId,
          templateMessage: editTemplateMessage,
          source: editSource,
          campaign: editCampaign,
          adset: editAdset,
          adName: editAdName,
          platform: editPlatform,
          medium: editMedium
        })
      });

      const payload = (await response.json()) as ShortlinkMutationResponse;
      if (!response.ok) {
        recordPerf("shortlinks.update", startedAt, false);
        throw new Error(payload.error?.message ?? "Failed to update shortlink.");
      }

      setIsEditDialogOpen(false);
      setEditingShortlinkId(null);
      if (activeBusiness?.id && payload.data?.shortlink) {
        updateShortlinksState(activeBusiness.id, (currentRows) =>
          currentRows.map((item) => (item.id === editingShortlinkId ? payload.data!.shortlink! : item))
        );
      } else {
        await loadShortlinks({ force: true });
      }
      setSuccess("Shortlink updated.");
      recordPerf("shortlinks.update", startedAt, true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update shortlink."));
      recordPerf("shortlinks.update", startedAt, false);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteShortlink(shortlinkId: string) {
    const confirmed = window.confirm("Hapus shortlink ini?");
    if (!confirmed) {
      return;
    }
    const startedAt = performance.now();

    try {
      setIsMutating(true);
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/shortlinks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness?.id ?? "",
          shortlinkId
        })
      });

      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        recordPerf("shortlinks.delete", startedAt, false);
        throw new Error(payload.error?.message ?? "Failed to delete shortlink.");
      }

      if (activeBusiness?.id) {
        updateShortlinksState(activeBusiness.id, (currentRows) => currentRows.filter((item) => item.id !== shortlinkId));
      } else {
        await loadShortlinks({ force: true });
      }
      setSuccess("Shortlink deleted.");
      recordPerf("shortlinks.delete", startedAt, true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete shortlink."));
      recordPerf("shortlinks.delete", startedAt, false);
    }
    finally {
      setIsMutating(false);
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

  const resolveUsableShortUrl = useCallback(
    (shortlink: ShortlinkItem): string => (runtimeOrigin ? `${runtimeOrigin}/r/${shortlink.code}` : shortlink.shortUrl),
    [runtimeOrigin]
  );

  return (
    <section className="space-y-4">
      {variant === "page" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 md:h-11 md:w-11 md:rounded-2xl">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">Shortlink System</h1>
              <p className="text-xs text-muted-foreground md:text-sm">Kelola shortlink kampanye, tracking, dan tautan publik dari satu workspace.</p>
            </div>
          </div>
          <Button
            type="button"
            className="h-10 rounded-xl"
            onMouseEnter={() => {
              void loadShortlinks();
            }}
            onFocus={() => {
              void loadShortlinks();
            }}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Tambah Shortlink
          </Button>
        </div>
      ) : null}
      {isRefreshing ? <p className="text-sm text-muted-foreground">Refreshing shortlinks...</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Short URL</TableHead>
              <TableHead>No. WA</TableHead>
              <TableHead>Template Pesan</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Adset</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Medium</TableHead>
              <TableHead className="text-right">Visitors</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && shortlinks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-20 text-center text-muted-foreground">
                  Loading shortlinks...
                </TableCell>
              </TableRow>
            ) : shortlinks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-20 text-center text-muted-foreground">
                  No shortlinks created yet.
                </TableCell>
              </TableRow>
            ) : (
              shortlinks.map((shortlink) => (
                <TableRow key={shortlink.id}>
                  <TableCell className="font-medium text-foreground">{shortlink.code}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    <a
                      href={resolveUsableShortUrl(shortlink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {resolveUsableShortUrl(shortlink)}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.waPhone ? `+${shortlink.waPhone}` : "-"}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">{shortlink.templateMessage ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.source}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.campaign ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.adset ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.adName ?? shortlink.ad ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.platform ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{shortlink.medium ?? "-"}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">{shortlink.visitorCount.toLocaleString("id-ID")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={shortlink.isEnabled}
                        disabled={isMutating}
                        onCheckedChange={(checked) => {
                          void handleToggleShortlink(shortlink.id, checked);
                        }}
                        aria-label={`Toggle shortlink ${shortlink.code}`}
                      />
                      <span className={shortlink.isEnabled ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"}>
                        {shortlink.isEnabled ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
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
                        <DropdownMenuItem onClick={() => void handleCopy(resolveUsableShortUrl(shortlink))}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy short URL
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(resolveUsableShortUrl(shortlink), "_blank", "noopener,noreferrer");
                          }}
                        >
                          Open short URL
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(shortlink)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleToggleShortlink(shortlink.id, !shortlink.isEnabled)}
                          disabled={isMutating}
                        >
                          {shortlink.isEnabled ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleDeleteShortlink(shortlink.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
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
            <DialogDescription>Buat shortlink CTWA otomatis dari nomor WhatsApp Baileys yang terhubung.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateShortlink} className="grid gap-3">
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Nomor Terhubung (Baileys)</p>
              <p className="mt-1 font-medium text-foreground">{connectedPhone || "Belum ada nomor terhubung"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Preview WA URL</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{destinationPreview}</p>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                disabled={!canOpenPreview}
                onClick={() => {
                  if (!canOpenPreview) {
                    return;
                  }
                  window.open(destinationPreview, "_blank", "noopener,noreferrer");
                }}
              >
                Open wa.me preview
              </Button>
            </div>
            <Input value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Nama shortlink / campaign" className="h-10 rounded-xl" />
            <p className="-mt-1 text-xs text-muted-foreground">Nama campaign untuk identifikasi link di dashboard dan report iklan.</p>
            <Input
              value={templateMessage}
              onChange={(event) => setTemplateMessage(event.target.value)}
              placeholder="Template pesan (contoh: Halo, saya tertarik promo ini)"
              className="h-10 rounded-xl"
            />
            <p className="-mt-1 text-xs text-muted-foreground">Pesan ini otomatis terisi saat user dibawa ke chat WhatsApp.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source (meta_ads)" className="h-10 rounded-xl" />
                <p className="text-xs text-muted-foreground">Sumber traffic, contoh: `meta_ads`, `organic`.</p>
              </div>
              <div className="space-y-1">
                <Input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="Platform (meta)" className="h-10 rounded-xl" />
                <p className="text-xs text-muted-foreground">Platform iklan, contoh: `meta`.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Input value={adset} onChange={(event) => setAdset(event.target.value)} placeholder="Adset" className="h-10 rounded-xl" />
                <p className="text-xs text-muted-foreground">Nama ad set dari Ads Manager.</p>
              </div>
              <div className="space-y-1">
                <Input value={adName} onChange={(event) => setAdName(event.target.value)} placeholder="Ad Name" className="h-10 rounded-xl" />
                <p className="text-xs text-muted-foreground">Nama iklan spesifik untuk analitik.</p>
              </div>
            </div>
            <div className="space-y-1">
              <Input value={medium} onChange={(event) => setMedium(event.target.value)} placeholder="Medium (paid_social)" className="h-10 rounded-xl" />
              <p className="text-xs text-muted-foreground">Tipe channel, contoh: `paid_social`, `cpc`.</p>
            </div>
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

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingShortlinkId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Edit Shortlink</DialogTitle>
            <DialogDescription>Ubah campaign, template, dan metadata Meta CAPI.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditShortlink} className="grid gap-3">
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Code</p>
              <p className="mt-1 font-medium text-foreground">{editingShortlink?.code ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Preview WA URL</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{editDestinationPreview}</p>
            </div>
            <Input value={editCampaign} onChange={(event) => setEditCampaign(event.target.value)} placeholder="Nama shortlink / campaign" className="h-10 rounded-xl" />
            <Input
              value={editTemplateMessage}
              onChange={(event) => setEditTemplateMessage(event.target.value)}
              placeholder="Template pesan"
              className="h-10 rounded-xl"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={editSource} onChange={(event) => setEditSource(event.target.value)} placeholder="Source (meta_ads)" className="h-10 rounded-xl" />
              <Input value={editPlatform} onChange={(event) => setEditPlatform(event.target.value)} placeholder="Platform (meta)" className="h-10 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={editAdset} onChange={(event) => setEditAdset(event.target.value)} placeholder="Adset" className="h-10 rounded-xl" />
              <Input value={editAdName} onChange={(event) => setEditAdName(event.target.value)} placeholder="Ad Name" className="h-10 rounded-xl" />
            </div>
            <Input value={editMedium} onChange={(event) => setEditMedium(event.target.value)} placeholder="Medium (paid_social)" className="h-10 rounded-xl" />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={!canSaveEdit}>
                {isMutating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
