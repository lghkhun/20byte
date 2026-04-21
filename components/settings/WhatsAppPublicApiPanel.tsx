"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, RotateCcw, ShieldX } from "lucide-react";

import type { BusinessSummary } from "@/components/settings/whatsapp/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

type PublicApiKeyInfo = {
  id: string;
  status: "ACTIVE" | "REVOKED";
  maskedKey: string;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
};

type PublicApiKeyResponse = {
  data?: {
    role?: string;
    key?: PublicApiKeyInfo | string | null;
    keyInfo?: PublicApiKeyInfo;
  };
};

type PublicWebhookResponse = {
  data?: {
    role?: string;
    webhook?: {
      url: string | null;
      enabled: boolean;
      eventFilters: string[];
      updatedAt: string | null;
      hasSecret: boolean;
      secret?: string;
    } | null;
    secret?: string;
  };
};

function toErrorMessage(payload: ApiErrorResponse | null, fallback: string): string {
  return payload?.error?.message ?? fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function WhatsAppPublicApiPanel({ activeBusiness }: { activeBusiness: BusinessSummary | null }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyInfo, setKeyInfo] = useState<PublicApiKeyInfo | null>(null);
  const [role, setRole] = useState<string>("OWNER");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSecretVisible, setWebhookSecretVisible] = useState<string | null>(null);
  const [eventFilterInbound, setEventFilterInbound] = useState(true);
  const [eventFilterOutbound, setEventFilterOutbound] = useState(true);
  const [eventFilterDevice, setEventFilterDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isOwner = role === "OWNER";

  const selectedFilters = useMemo(() => {
    const items: string[] = [];
    if (eventFilterInbound) {
      items.push("message.inbound");
    }
    if (eventFilterOutbound) {
      items.push("message.outbound.status");
    }
    if (eventFilterDevice) {
      items.push("device.connection");
    }
    return items;
  }, [eventFilterDevice, eventFilterInbound, eventFilterOutbound]);

  const loadState = useCallback(async () => {
    if (!activeBusiness) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [keyRes, webhookRes] = await Promise.all([
        fetch(`/api/whatsapp/public-api/key?orgId=${encodeURIComponent(activeBusiness.id)}`, { cache: "no-store" }),
        fetch(`/api/whatsapp/public-api/webhook?orgId=${encodeURIComponent(activeBusiness.id)}`, { cache: "no-store" })
      ]);

      const keyPayload = (await keyRes.json().catch(() => null)) as PublicApiKeyResponse | null;
      const webhookPayload = (await webhookRes.json().catch(() => null)) as PublicWebhookResponse | null;

      if (!keyRes.ok) {
        throw new Error(toErrorMessage(keyPayload as ApiErrorResponse | null, "Failed to load API key state."));
      }
      if (!webhookRes.ok) {
        throw new Error(toErrorMessage(webhookPayload as ApiErrorResponse | null, "Failed to load webhook state."));
      }

      setRole(keyPayload?.data?.role ?? webhookPayload?.data?.role ?? "OWNER");
      setKeyInfo(
        typeof keyPayload?.data?.key === "object" && keyPayload?.data?.key
          ? (keyPayload.data.key as PublicApiKeyInfo)
          : null
      );

      const webhook = webhookPayload?.data?.webhook;
      if (webhook) {
        setWebhookUrl(webhook.url ?? "");
        setWebhookEnabled(Boolean(webhook.enabled));
        setEventFilterInbound((webhook.eventFilters ?? []).includes("message.inbound"));
        setEventFilterOutbound((webhook.eventFilters ?? []).includes("message.outbound.status"));
        setEventFilterDevice((webhook.eventFilters ?? []).includes("device.connection"));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load public API settings.");
    } finally {
      setIsLoading(false);
    }
  }, [activeBusiness]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function handleGenerateOrRotate() {
    if (!activeBusiness) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/whatsapp/public-api/key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orgId: activeBusiness.id })
      });
      const payload = (await response.json().catch(() => null)) as PublicApiKeyResponse | null;
      if (!response.ok) {
        throw new Error(toErrorMessage(payload as ApiErrorResponse | null, "Failed to generate API key."));
      }

      setGeneratedKey(typeof payload?.data?.key === "string" ? payload.data.key : null);
      setKeyInfo(payload?.data?.keyInfo ?? null);
      setInfo("API key berhasil dibuat/dirotasi. Secret hanya tampil sekali.");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate API key.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke() {
    if (!activeBusiness) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/whatsapp/public-api/key", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orgId: activeBusiness.id })
      });
      const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Failed to revoke API key."));
      }

      setGeneratedKey(null);
      await loadState();
      setInfo("API key berhasil direvoke.");
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke API key.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveWebhook(regenerateSecret = false) {
    if (!activeBusiness) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/whatsapp/public-api/webhook", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness.id,
          url: webhookUrl,
          enabled: webhookEnabled,
          eventFilters: selectedFilters,
          regenerateSecret
        })
      });

      const payload = (await response.json().catch(() => null)) as PublicWebhookResponse | ApiErrorResponse | null;
      if (!response.ok) {
        throw new Error(toErrorMessage(payload as ApiErrorResponse | null, "Failed to save webhook config."));
      }

      setWebhookSecretVisible((payload as PublicWebhookResponse | null)?.data?.secret ?? null);
      setInfo(regenerateSecret ? "Webhook secret baru berhasil dibuat." : "Webhook config berhasil disimpan.");
      await loadState();
    } catch (webhookError) {
      setError(webhookError instanceof Error ? webhookError.message : "Failed to save webhook config.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyText(value: string | null) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setInfo("Berhasil disalin ke clipboard.");
  }

  return (
    <div className="rounded-[28px] border border-border/70 bg-gradient-to-b from-card to-card/90 p-5 md:p-7 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] relative overflow-hidden group">
      <div className="flex flex-wrap items-start justify-between gap-3 relative z-10">
        <div>
          <h3 className="text-[20px] font-bold tracking-tight text-foreground">
            API Integration <span className="text-[15px] font-semibold text-muted-foreground/80">(Public WhatsApp API v1)</span>
          </h3>
          <p className="mt-1.5 text-[14px] text-muted-foreground/80">Kelola API key dan webhook dalam satu pengaturan sederhana.</p>
        </div>
        <Button asChild variant="secondary" size="sm" className="rounded-xl h-9">
          <a href="/developers/whatsapp-api" target="_blank" rel="noreferrer">
            Lihat Dokumentasi
          </a>
        </Button>
      </div>

      <div className="mt-6 rounded-3xl border border-border/60 bg-gradient-to-br from-background/80 to-muted/20 p-5 md:p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md relative z-10">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">API Key</p>
            </div>
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              Status: <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${keyInfo?.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>{keyInfo?.status ?? "BELUM DIBUAT"}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground bg-background rounded-xl px-3 py-2 border border-border/50 max-w-fit">
              <span className="font-mono">Masked: {keyInfo?.maskedKey ?? "-"}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-primary hover:bg-primary/10" onClick={() => void copyText(keyInfo?.maskedKey ?? null)} disabled={!keyInfo?.maskedKey}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />Copy
              </Button>
            </div>
            <div className="flex flex-col gap-1 text-[13px] text-muted-foreground/70">
              <p>Created: {formatDate(keyInfo?.createdAt ?? null)}</p>
              {keyInfo?.rotatedAt && <p>Rotated: {formatDate(keyInfo?.rotatedAt)}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void handleGenerateOrRotate()} disabled={!isOwner || isSubmitting || isLoading}>
              <KeyRound className="mr-2 h-4 w-4" />
              {keyInfo ? "Rotate" : "Generate"}
            </Button>
            <Button size="sm" variant="secondary" className="rounded-xl h-9" onClick={() => void copyText(generatedKey)} disabled={!generatedKey}>
              <Copy className="mr-2 h-4 w-4" />Copy Secret
            </Button>
            <Button size="sm" variant="destructive" className="rounded-xl h-9" onClick={() => void handleRevoke()} disabled={!isOwner || isSubmitting || !keyInfo}>
              <ShieldX className="mr-2 h-4 w-4" />Revoke
            </Button>
          </div>
        </div>

        {generatedKey ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4 flex items-center justify-between gap-4 overflow-hidden">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Secret hanya tampil sekali!</p>
              <p className="mt-1 break-all font-mono text-sm font-medium text-foreground">{generatedKey}</p>
            </div>
            <Button size="sm" variant="outline" className="border-emerald-500/30 hover:bg-emerald-500/10 shrink-0 rounded-xl" onClick={() => void copyText(generatedKey)}>
              <Copy className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />Copy
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-3xl border border-border/60 bg-gradient-to-br from-background/80 to-muted/20 p-5 md:p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md relative z-10">
        <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <ShieldX className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Webhook</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 shadow-sm">
            <span className="text-[13px] font-semibold text-foreground">Enable Webhook</span>
            <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} disabled={!isOwner || isSubmitting} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full bg-background rounded-xl border border-border/60 flex items-center shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            <span className="pl-4 text-muted-foreground select-none">URL:</span>
            <Input
              placeholder="https://platform-kamu.com/hooks/20byte"
              className="border-0 focus-visible:ring-0 bg-transparent"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              disabled={!isOwner || isSubmitting}
            />
          </div>
          <Button size="sm" variant="secondary" className="rounded-xl h-10 w-full md:w-auto shrink-0" onClick={() => void copyText(webhookUrl || null)} disabled={!webhookUrl}>
            <Copy className="mr-2 h-4 w-4" />Copy URL
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-border/40 bg-background/50 px-5 py-4">
          <p className="text-[13px] font-semibold text-muted-foreground w-full md:w-auto">Event Triggers:</p>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={eventFilterInbound} onCheckedChange={(c) => setEventFilterInbound(c === true)} disabled={!isOwner || isSubmitting} className="h-5 w-5 rounded-md" />
            <span className="text-[14px] font-medium transition-colors group-hover:text-primary">Inbound</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={eventFilterOutbound} onCheckedChange={(c) => setEventFilterOutbound(c === true)} disabled={!isOwner || isSubmitting} className="h-5 w-5 rounded-md" />
            <span className="text-[14px] font-medium transition-colors group-hover:text-primary">Outbound Status</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={eventFilterDevice} onCheckedChange={(c) => setEventFilterDevice(c === true)} disabled={!isOwner || isSubmitting} className="h-5 w-5 rounded-md" />
            <span className="text-[14px] font-medium transition-colors group-hover:text-primary">Device Connection</span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border/50 pt-5">
          <Button size="sm" className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void handleSaveWebhook(false)} disabled={!isOwner || isSubmitting || isLoading}>
            Simpan Webhook
          </Button>
          <Button size="sm" variant="secondary" className="rounded-xl h-9" onClick={() => void handleSaveWebhook(true)} disabled={!isOwner || isSubmitting || isLoading}>
            <RotateCcw className="mr-2 h-4 w-4" />Regenerate Secret
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl h-9" onClick={() => void copyText(webhookSecretVisible)} disabled={!webhookSecretVisible}>
            <Copy className="mr-2 h-4 w-4" />Copy Secret
          </Button>
        </div>

        {webhookSecretVisible ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Webhook secret aktif</p>
              <p className="mt-1 break-all font-mono text-[14px] font-medium text-foreground">{webhookSecretVisible}</p>
            </div>
            <Button size="sm" variant="outline" className="border-emerald-500/30 hover:bg-emerald-500/10 shrink-0 rounded-xl w-full md:w-auto" onClick={() => void copyText(webhookSecretVisible)}>
              <Copy className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />Copy Secret
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? <p className="mt-5 text-sm text-muted-foreground animate-pulse">Loading API settings...</p> : null}
      {error ? <p className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive shadow-sm flex items-center gap-2"><ShieldX className="h-4 w-4"/>{error}</p> : null}
      {info ? <p className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[14px] text-emerald-600 dark:text-emerald-400 shadow-sm">{info}</p> : null}

      {!isOwner ? <p className="mt-5 px-2 text-[13px] font-medium text-amber-600 dark:text-amber-400">Pemberitahuan: Role {role} hanya memiliki akses baca. Perubahan pengaturan tidak diizinkan.</p> : null}
    </div>
  );
}
