"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Camera, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsHeaderAction } from "@/components/settings/settings-header-actions";
import { fetchJsonCached } from "@/lib/client/fetchCache";
import { invalidateLocalImageCache, useLocalImageCache } from "@/lib/client/localImageCache";

type ProfileApiResponse = {
  data?: {
    user?: {
      id: string;
      email: string;
      phoneE164: string | null;
      name: string | null;
      avatarUrl: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

function resolveError(payload: ProfileApiResponse | null, fallback: string) {
  return payload?.error?.message ?? fallback;
}

function dispatchProfileUpdated(detail: { email: string; name: string | null; avatarUrl: string | null; avatarVersion?: string }) {
  window.dispatchEvent(new CustomEvent("app-profile-updated", { detail }));
}

export function ProfileSettings() {
  const formId = "settings-profile-form";
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const cachedAvatarUrl = useLocalImageCache(avatarUrl, {
    cacheKey: `profile-avatar:${email.toLowerCase()}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 256 * 1024
  });
  const canSubmit = Boolean(!isLoading && !isSaving && name.trim() && phone.trim());
  const saveAction = useMemo(
    () => (
      <Button disabled={!canSubmit} type="submit" form={formId} className="h-11 rounded-xl px-6 font-semibold shadow-md shadow-primary/20">
        {isSaving ? "Menyimpan..." : "Simpan Profil"}
      </Button>
    ),
    [canSubmit, formId, isSaving]
  );

  useSettingsHeaderAction("10-profile-save", saveAction);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);

        const payload = await fetchJsonCached<ProfileApiResponse>("/api/auth/profile", {
          ttlMs: 12_000,
          init: { cache: "no-store" }
        });
        if (!payload?.data?.user) {
          throw new Error(resolveError(payload, "Failed to load profile."));
        }

        if (!mounted) {
          return;
        }

        setEmail(payload.data.user.email);
        setPhone(payload.data.user.phoneE164 ?? "");
        setName(payload.data.user.name ?? "");
        setAvatarUrl(payload.data.user.avatarUrl ?? null);
        dispatchProfileUpdated({
          email: payload.data.user.email,
          name: payload.data.user.name ?? null,
          avatarUrl: payload.data.user.avatarUrl ?? null,
          avatarVersion: payload.data.user.updatedAt
        });
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as ProfileApiResponse | null;
      if (!response.ok) {
        throw new Error(resolveError(payload, "Failed to update profile."));
      }

      if (payload?.data?.user) {
        invalidateLocalImageCache(`profile-avatar:${payload.data.user.email.toLowerCase()}`);
        invalidateLocalImageCache(`user-avatar:${payload.data.user.email.toLowerCase()}`);
        setName(payload.data.user.name ?? "");
        setPhone(payload.data.user.phoneE164 ?? "");
        setAvatarUrl(payload.data.user.avatarUrl ?? null);
        dispatchProfileUpdated({
          email: payload.data.user.email,
          name: payload.data.user.name ?? null,
          avatarUrl: payload.data.user.avatarUrl ?? null,
          avatarVersion: payload.data.user.updatedAt
        });
      }
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Profile updated successfully.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    setIsUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.set("file", file, file.name);

      const response = await fetch("/api/auth/profile/avatar", {
        method: "POST",
        body
      });
      const payload = (await response.json().catch(() => null)) as ProfileApiResponse | null;
      if (!response.ok || !payload?.data?.user) {
        throw new Error(resolveError(payload, "Failed to upload avatar."));
      }

      invalidateLocalImageCache(`profile-avatar:${payload.data.user.email.toLowerCase()}`);
      invalidateLocalImageCache(`user-avatar:${payload.data.user.email.toLowerCase()}`);
      setAvatarUrl(payload.data.user.avatarUrl ?? null);
      dispatchProfileUpdated({
        email: payload.data.user.email,
        name: payload.data.user.name ?? null,
        avatarUrl: payload.data.user.avatarUrl ?? null,
        avatarVersion: payload.data.user.updatedAt
      });
      setSuccess("Avatar updated successfully.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload avatar.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <section className="space-y-4">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading profile...</p> : null}

      {!isLoading ? (
        <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Avatar</label>
            <div className="flex flex-col gap-5 rounded-[20px] border border-border/50 bg-gradient-to-br from-card to-background/50 p-5 sm:flex-row sm:items-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
              <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-border/60 bg-muted/30 shadow-inner">
                {avatarUrl ? (
                  <Image src={cachedAvatarUrl ?? avatarUrl} alt={name || email} fill unoptimized className="object-cover" />
                ) : (
                  <UserCircle2 className="h-10 w-10 text-muted-foreground/50" />
                )}
              </div>
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-muted-foreground/80">Upload PNG atau JPG maksimal 2 MB untuk foto profil akun Anda.</p>
                <Button type="button" variant="outline" className="h-10 rounded-xl font-semibold shadow-sm hover:bg-muted/30" disabled={isUploadingAvatar} asChild>
                  <label className="cursor-pointer">
                    <Camera className="mr-2 h-4 w-4" />
                    {isUploadingAvatar ? "Uploading..." : "Pilih Avatar"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleAvatarUpload(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="profile-email">
              Email
            </label>
            <Input
              id="profile-email"
              value={email}
              disabled
              className="h-11 rounded-xl bg-muted/30 font-medium text-muted-foreground/70"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="profile-name">
              Display Name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="h-11 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="profile-phone">
              WhatsApp Number
            </label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+628123456789 atau 08123456789"
              required
              className="h-11 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40 mt-6">
            <div className="space-y-1">
              <h3 className="text-[14px] font-bold text-foreground">Ganti Password</h3>
              <p className="text-[12px] font-medium text-muted-foreground/80">Kosongkan jika Anda tidak ingin mengganti password Anda.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="current-password">
                  Password Saat Ini
                </label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                  className="h-11 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80" htmlFor="new-password">
                  Password Baru
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 rounded-xl bg-muted/20 font-medium text-foreground transition-all focus-visible:bg-transparent"
                />
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 shadow-sm mt-6">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 shadow-sm mt-6">
              {success}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
