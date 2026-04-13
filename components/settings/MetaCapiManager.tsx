"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";

import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { fetchJsonCached, invalidateFetchCache } from "@/lib/client/fetchCache";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OrgItem = {
  id: string;
  name: string;
};

type MetaIntegrationView = {
  orgId: string;
  datasetId: string;
  legacyPixelId: string | null;
  testEventCode: string | null;
  enabled: boolean;
  hasAccessToken: boolean;
  updatedAt: string | null;
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type MetaStatusView = {
  queueDepth: number | null;
  sent24h: number;
  failed24h: number;
  lastSentAt: string | null;
  lastFailedAt: string | null;
  lastFailedReason: string | null;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function MetaCapiManager() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [connectedPhone, setConnectedPhone] = useState("");
  const [eventStatus, setEventStatus] = useState<MetaStatusView | null>(null);
  const [activeTab, setActiveTab] = useState("configuration");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadIntegration = useCallback(async () => {
    const payload = await fetchJsonCached<{ data?: { integration?: MetaIntegrationView | null } } & ApiError>("/api/meta/integration", {
      ttlMs: 15_000,
      init: { cache: "no-store" }
    });

    const integration = payload.data?.integration ?? null;
    setDatasetId(integration?.datasetId ?? integration?.legacyPixelId ?? "");
    setTestEventCode(integration?.testEventCode ?? "");
    setEnabled(integration?.enabled ?? false);
    setHasAccessToken(Boolean(integration?.hasAccessToken));
    setAccessTokenInput("");
  }, []);

  const loadMetaStatus = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const payload = await fetchJsonCached<{ data?: { status?: MetaStatusView } } & ApiError>("/api/meta/integration/status", {
        ttlMs: 10_000,
        init: { cache: "no-store" }
      });
      setEventStatus(payload.data?.status ?? null);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const loadConnectedPhone = useCallback(async () => {
    if (!activeBusiness) {
      return;
    }
    const payload = await fetchJsonCached<{
      data?: {
        connection?: {
          connectedAccount?: {
            displayPhone?: string | null;
          } | null;
        } | null;
      };
      error?: {
        code?: string;
        message?: string;
      };
    }>(`/api/whatsapp/baileys?orgId=${encodeURIComponent(activeBusiness.id)}`, {
      ttlMs: 8_000,
      init: { cache: "no-store" }
    });
    const phone = payload.data?.connection?.connectedAccount?.displayPhone?.trim() ?? "";
    setConnectedPhone(phone);
    setTestPhoneNumber((current) => current || phone);
  }, [activeBusiness]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        await loadOrganizations();
        if (mounted) {
          await loadIntegration();
          await loadMetaStatus();
          await loadConnectedPhone();
        }
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to initialize Meta integration settings."));
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
  }, [loadConnectedPhone, loadIntegration, loadMetaStatus, loadOrganizations]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    notifySuccess(success);
  }, [success]);

  async function handleSave() {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/meta/integration", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          datasetId,
          accessToken: accessTokenInput.trim() ? accessTokenInput : undefined,
          testEventCode: testEventCode.trim() || null,
          enabled
        })
      });

      const payload = (await response.json()) as { data?: { integration?: MetaIntegrationView } } & ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to save Meta integration.");
      }

      const integration = payload.data?.integration;
      setHasAccessToken(Boolean(integration?.hasAccessToken));
      setAccessTokenInput("");
      invalidateFetchCache("GET:/api/meta/integration");
      invalidateFetchCache("GET:/api/meta/integration/status");
      await loadMetaStatus();
      setSuccess("Konfigurasi Meta Dataset & CAPI tersimpan.");
    } catch (err) {
      setError(toErrorMessage(err, "Gagal menyimpan konfigurasi Meta Dataset & CAPI."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTestEvent() {
    try {
      setIsSendingTest(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/meta/integration/test-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber.trim() || undefined
        })
      });

      const payload = (await response.json()) as { data?: { eventId?: string; phone?: string } } & ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to send Meta test event.");
      }

      await loadMetaStatus();
      setSuccess(`Test event terkirim (${payload.data?.eventId ?? "-"}) ke nomor ${payload.data?.phone ?? "-"}.`);
    } catch (err) {
      setError(toErrorMessage(err, "Gagal mengirim test event ke Meta."));
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Meta Dataset + Conversions API</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Konfigurasi disimpan per bisnis di server. Access token tidak pernah dikembalikan ke frontend.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-10 rounded-xl">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="test-event">Test Event</TabsTrigger>
          <TabsTrigger value="queue-status">Queue Status</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-foreground">Meta Dataset</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataset-id">Dataset ID</Label>
                <Input
                  id="dataset-id"
                  value={datasetId}
                  onChange={(event) => setDatasetId(event.currentTarget.value)}
                  placeholder="Contoh: 123456789012345"
                  autoComplete="off"
                  disabled={isLoading || isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-event-code">Test Event Code (Opsional)</Label>
                <Input
                  id="test-event-code"
                  value={testEventCode}
                  onChange={(event) => setTestEventCode(event.currentTarget.value)}
                  placeholder="Contoh: TEST12345"
                  autoComplete="off"
                  disabled={isLoading || isSaving}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-sky-600" />
                <p className="text-sm font-semibold text-foreground">Conversions API</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capi-token">CAPI Access Token</Label>
                <Input
                  id="capi-token"
                  type="password"
                  value={accessTokenInput}
                  onChange={(event) => setAccessTokenInput(event.currentTarget.value)}
                  placeholder={hasAccessToken ? "Token tersimpan. Isi jika ingin mengganti." : "Masukkan token Conversions API"}
                  autoComplete="off"
                  disabled={isLoading || isSaving}
                />
                <p className="text-xs text-muted-foreground">{hasAccessToken ? "Token sudah tersimpan aman di server." : "Token belum disimpan."}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Aktifkan integrasi</p>
                  <p className="text-xs text-muted-foreground">Kirim event conversion via dataset CAPI.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isLoading || isSaving} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" className="rounded-xl" onClick={() => void handleSave()} disabled={isLoading || isSaving || !activeBusiness}>
              {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="test-event" className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
            <p className="text-sm font-semibold text-foreground">Kirim Test Event ke Meta</p>
            <p className="text-xs text-muted-foreground">Gunakan nomor WhatsApp customer atau nomor connected device untuk validasi event di Test Events Manager.</p>
            <div className="space-y-2">
              <Label htmlFor="test-phone">Phone Number</Label>
              <Input
                id="test-phone"
                value={testPhoneNumber}
                onChange={(event) => setTestPhoneNumber(event.currentTarget.value)}
                placeholder={connectedPhone ? `Contoh: ${connectedPhone}` : "Contoh: 628123456789"}
                autoComplete="off"
                disabled={isLoading || isSendingTest}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void handleSendTestEvent()}
                disabled={isLoading || isSendingTest || !datasetId.trim() || !hasAccessToken}
              >
                {isSendingTest ? "Sending..." : "Send Test Event"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="queue-status" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">Queue Depth</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{eventStatus?.queueDepth ?? "-"}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">Sent (24h)</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{eventStatus?.sent24h ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">Failed (24h)</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{eventStatus?.failed24h ?? 0}</p>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Last Delivery Logs</p>
              <Button type="button" variant="outline" className="h-8 rounded-xl" disabled={isLoadingStatus} onClick={() => void loadMetaStatus()}>
                {isLoadingStatus ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Last success: {formatTimestamp(eventStatus?.lastSentAt ?? null)}</p>
            <p className="text-sm text-muted-foreground">Last failure: {formatTimestamp(eventStatus?.lastFailedAt ?? null)}</p>
            <p className="text-sm text-muted-foreground">Failure reason: {eventStatus?.lastFailedReason ?? "-"}</p>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
