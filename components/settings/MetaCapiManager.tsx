"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";

import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationFeedback } from "@/components/ui/operation-feedback";
import { Switch } from "@/components/ui/switch";

type OrgItem = {
  id: string;
  name: string;
};

type MetaIntegrationView = {
  orgId: string;
  pixelId: string;
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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function MetaCapiManager() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadIntegration = useCallback(async () => {
    const response = await fetch("/api/meta/integration", { cache: "no-store" });
    const payload = (await response.json()) as { data?: { integration?: MetaIntegrationView | null } } & ApiError;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load Meta integration.");
    }

    const integration = payload.data?.integration ?? null;
    setPixelId(integration?.pixelId ?? "");
    setTestEventCode(integration?.testEventCode ?? "");
    setEnabled(integration?.enabled ?? false);
    setHasAccessToken(Boolean(integration?.hasAccessToken));
    setAccessTokenInput("");
  }, []);

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
  }, [loadIntegration, loadOrganizations]);

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
          pixelId,
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
      setSuccess("Konfigurasi Meta Pixel & CAPI tersimpan.");
    } catch (err) {
      setError(toErrorMessage(err, "Gagal menyimpan konfigurasi Meta Pixel & CAPI."));
    } finally {
      setIsSaving(false);
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
            <p className="text-sm font-semibold text-foreground">Meta Pixel + Conversions API</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Konfigurasi disimpan per bisnis di server. Access token tidak pernah dikembalikan ke frontend.
            </p>
          </div>
        </div>
      </div>

      {error ? <OperationFeedback tone="error" message={error} /> : null}
      {!error && success ? <OperationFeedback tone="success" message={success} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold text-foreground">Meta Pixel</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pixel-id">Pixel ID</Label>
            <Input
              id="pixel-id"
              value={pixelId}
              onChange={(event) => setPixelId(event.currentTarget.value)}
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
              <p className="text-xs text-muted-foreground">Kirim event conversion via CAPI.</p>
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
    </section>
  );
}
