"use client";

import Image from "next/image";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Building2, Landmark, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsHeaderAction } from "@/components/settings/settings-header-actions";

type BusinessProfile = {
  id: string;
  name: string;
  legalName: string | null;
  responsibleName: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessNpwp: string | null;
  businessAddress: string | null;
  logoUrl: string | null;
  invoiceSignatureUrl: string | null;
};

type BusinessProfileResponse = {
  data?: {
    profile?: BusinessProfile;
    url?: string;
  };
  error?: {
    message?: string;
  };
};

function formatNpwpInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 9),
    digits.slice(9, 12),
    digits.slice(12, 15)
  ];

  let output = "";
  if (parts[0]) output += parts[0];
  if (parts[1]) output += `.${parts[1]}`;
  if (parts[2]) output += `.${parts[2]}`;
  if (parts[3]) output += `.${parts[3]}`;
  if (parts[4]) output += `-${parts[4]}`;
  if (parts[5]) output += `.${parts[5]}`;
  return output;
}

function UploadAssetCard({
  title,
  description,
  imageUrl,
  placeholderIcon,
  onUpload,
  isUploading
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  placeholderIcon: ReactNode;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  const inputId = useId();

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <label htmlFor={inputId} className="flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-sky-300 bg-sky-50/40 p-4 text-center">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} width={220} height={140} className="max-h-32 w-auto object-contain" unoptimized />
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-sky-100 text-sky-700">{placeholderIcon}</div>
            <div>
              <p className="text-sm font-medium text-foreground">Upload PNG atau JPG</p>
              <p className="text-xs text-muted-foreground">Dipakai sebagai default invoice asset</p>
            </div>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void onUpload(file);
            }
            event.currentTarget.value = "";
          }}
        />
      </label>
      <Button type="button" variant="secondary" className="rounded-md" disabled={isUploading} asChild>
        <label htmlFor={inputId} className="cursor-pointer">
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Asset"}
        </label>
      </Button>
    </div>
  );
}

export function BusinessSettings() {
  const formId = "settings-business-form";
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessNpwp, setBusinessNpwp] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"logo" | "signature" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSave = useMemo(() => Boolean(name.trim()) && !isSaving, [isSaving, name]);
  const saveAction = useMemo(
    () => (
      <Button disabled={!canSave} type="submit" form={formId} className="h-10 rounded-xl">
        {isSaving ? "Saving..." : "Simpan Business"}
      </Button>
    ),
    [canSave, formId, isSaving]
  );

  useSettingsHeaderAction("10-business-save", saveAction);

  const applyProfile = useCallback((nextProfile: BusinessProfile) => {
    setProfile(nextProfile);
    setName(nextProfile.name);
    setLegalName(nextProfile.legalName ?? "");
    setResponsibleName(nextProfile.responsibleName ?? "");
    setBusinessPhone(nextProfile.businessPhone ?? "");
    setBusinessEmail(nextProfile.businessEmail ?? "");
    setBusinessNpwp(nextProfile.businessNpwp ? formatNpwpInput(nextProfile.businessNpwp) : "");
    setBusinessAddress(nextProfile.businessAddress ?? "");
  }, []);

  const loadProfile = useCallback(async () => {
    const response = await fetch("/api/orgs/business", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as BusinessProfileResponse | null;
    if (!response.ok || !payload?.data?.profile) {
      throw new Error(payload?.error?.message ?? "Failed to load business profile.");
    }

    applyProfile(payload.data.profile);
  }, [applyProfile]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);
        setError(null);
        await loadProfile();
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load business profile.");
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
  }, [loadProfile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/orgs/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          legalName,
          responsibleName,
          businessPhone,
          businessEmail,
          businessNpwp,
          businessAddress,
          logoUrl: profile?.logoUrl ?? null,
          invoiceSignatureUrl: profile?.invoiceSignatureUrl ?? null
        })
      });

      const payload = (await response.json().catch(() => null)) as BusinessProfileResponse | null;
      if (!response.ok || !payload?.data?.profile) {
        throw new Error(payload?.error?.message ?? "Failed to update business profile.");
      }

      applyProfile(payload.data.profile);
      setSuccess("Business profile updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update business profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssetUpload(assetType: "logo" | "signature", file: File) {
    setUploadingAsset(assetType);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.set("assetType", assetType);
      body.set("file", file, file.name);

      const response = await fetch("/api/orgs/business-assets", {
        method: "POST",
        body
      });
      const payload = (await response.json().catch(() => null)) as BusinessProfileResponse | null;
      if (!response.ok || !payload?.data?.profile) {
        throw new Error(payload?.error?.message ?? "Failed to upload asset.");
      }

      applyProfile(payload.data.profile);
      setSuccess(assetType === "logo" ? "Business logo updated." : "Invoice signature updated.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload asset.");
    } finally {
      setUploadingAsset(null);
    }
  }

  return (
    <section className="space-y-6">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading business profile...</p> : null}

      {!isLoading ? (
        <form id={formId} className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-name">
                Nama Business
              </label>
              <Input id="business-name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-md" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-legal-name">
                Nama Legal
              </label>
              <Input
                id="business-legal-name"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                placeholder="PT / CV / Yayasan / Firma / dll."
                className="rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-responsible-name">
                Nama Pimpinan / Direktur / Penanggung Jawab
              </label>
              <Input
                id="business-responsible-name"
                value={responsibleName}
                onChange={(event) => setResponsibleName(event.target.value)}
                className="rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-phone">
                Nomor Telepon Business
              </label>
              <Input id="business-phone" value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} className="rounded-md" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-email">
                Email Business
              </label>
              <Input id="business-email" value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} className="rounded-md" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-npwp">
                NPWP Business
              </label>
              <Input
                id="business-npwp"
                value={businessNpwp}
                onChange={(event) => setBusinessNpwp(formatNpwpInput(event.target.value))}
                placeholder="00.000.000.0-000.000"
                className="rounded-md"
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-foreground" htmlFor="business-address">
                Alamat Business
              </label>
              <textarea
                id="business-address"
                value={businessAddress}
                onChange={(event) => setBusinessAddress(event.target.value)}
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Asset Invoice</h3>
              <p className="mt-1 text-sm text-muted-foreground">Logo dan tanda tangan default dipakai otomatis saat membuat invoice baru.</p>
            </div>
          </div>

          {profile ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <UploadAssetCard
                title="Logo Business"
                description="Dipakai sebagai logo default invoice."
                imageUrl={profile.logoUrl}
                placeholderIcon={<Building2 className="h-7 w-7" />}
                onUpload={(file) => handleAssetUpload("logo", file)}
                isUploading={uploadingAsset === "logo"}
              />
              <UploadAssetCard
                title="Tanda Tangan Invoice"
                description="Dipakai sebagai tanda tangan default invoice."
                imageUrl={profile.invoiceSignatureUrl}
                placeholderIcon={<Landmark className="h-7 w-7" />}
                onUpload={(file) => handleAssetUpload("signature", file)}
                isUploading={uploadingAsset === "signature"}
              />
            </div>
          ) : (
            <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              Asset belum bisa dimuat. Refresh halaman setelah profile berhasil terbaca.
            </p>
          )}

          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {success ? <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{success}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
