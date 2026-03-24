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
      <Button disabled={!canSubmit} type="submit" form={formId} className="h-10 rounded-xl">
        {isSaving ? "Saving..." : "Simpan Profil"}
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
            <label className="text-sm font-medium text-foreground">Avatar</label>
            <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-center">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/50">
                {avatarUrl ? (
                  <Image src={cachedAvatarUrl ?? avatarUrl} alt={name || email} fill unoptimized className="object-cover" />
                ) : (
                  <UserCircle2 className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Upload PNG atau JPG maksimal 2 MB untuk foto profil akun Anda.</p>
                <Button type="button" variant="secondary" className="h-10 rounded-xl" disabled={isUploadingAvatar} asChild>
                  <label className="cursor-pointer">
                    <Camera className="mr-2 h-4 w-4" />
                    {isUploadingAvatar ? "Uploading..." : "Upload Avatar"}
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="profile-email">
              Email
            </label>
            <Input
              id="profile-email"
              value={email}
              disabled
              className="bg-background/60 text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="profile-name">
              Display Name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="profile-phone">
              WhatsApp Number
            </label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+628123456789 atau 08123456789"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="current-password">
                Current Password
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="new-password">
                New Password
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {success}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
