"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProfileApiResponse = {
  data?: {
    user?: {
      id: string;
      email: string;
      name: string | null;
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

export function ProfileSettings() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/auth/profile", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as ProfileApiResponse | null;
        if (!response.ok || !payload?.data?.user) {
          throw new Error(resolveError(payload, "Failed to load profile."));
        }

        if (!mounted) {
          return;
        }

        setEmail(payload.data.user.email);
        setName(payload.data.user.name ?? "");
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
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as ProfileApiResponse | null;
      if (!response.ok) {
        throw new Error(resolveError(payload, "Failed to update profile."));
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

  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-surface/70 p-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">Update your display name and password.</p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading profile...</p> : null}

      {!isLoading ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
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

          <div className="flex justify-end">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
