"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, RefreshCw } from "lucide-react";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OrgItem = {
  id: string;
  name: string;
  role: string;
};

type OrgMember = {
  orgId: string;
  userId: string;
  role: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type ApiError = {
  error?: {
    message?: string;
  };
};

const MAX_NON_OWNER_MEMBERS = 4;
const STAFF_ROLES = ["CS", "ADVERTISER"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

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

export function TeamSettings() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("CS");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingForUserId, setIsResendingForUserId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSetupLink, setLastSetupLink] = useState<string | null>(null);
  const [lastSetupMailtoUrl, setLastSetupMailtoUrl] = useState<string | null>(null);

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const nonOwnerCount = useMemo(() => members.filter((member) => member.role !== "OWNER").length, [members]);
  const reachedLimitForNewMember = nonOwnerCount >= MAX_NON_OWNER_MEMBERS;

  const canSubmit = Boolean(
    activeBusiness &&
      email.trim() &&
      !isSubmitting &&
      !reachedLimitForNewMember
  );

  const createAction = useMemo(
    () => (
      <Button
        type="button"
        disabled={reachedLimitForNewMember}
        className="h-10 rounded-xl"
        onClick={() => {
          setName("");
          setEmail("");
          setRole("CS");
          setLastSetupLink(null);
          setLastSetupMailtoUrl(null);
          setIsCreateDialogOpen(true);
        }}
      >
        Undang Staff
      </Button>
    ),
    [reachedLimitForNewMember]
  );

  useSettingsHeaderAction("10-team-create", createAction);

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadMembers = useCallback(async (orgId: string) => {
    const response = await fetch(`/api/orgs/members?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { data?: { members?: OrgMember[] } } & ApiError;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Failed to load members.");
    }
    setMembers(payload.data?.members ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        await loadOrganizations();
      } catch (loadError) {
        if (mounted) {
          setError(toErrorMessage(loadError, "Failed to initialize team settings."));
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
    async function syncMembers() {
      if (!activeBusiness) {
        setMembers([]);
        return;
      }
      try {
        setError(null);
        setSuccess(null);
        await loadMembers(activeBusiness.id);
      } catch (loadError) {
        if (mounted) {
          setError(toErrorMessage(loadError, "Failed to load team members."));
        }
      }
    }
    void syncMembers();
    return () => {
      mounted = false;
    };
  }, [activeBusiness, loadMembers]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    notifySuccess(success);
  }, [success]);

  async function handleCreateStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !activeBusiness) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      setLastSetupLink(null);
      setLastSetupMailtoUrl(null);

      const response = await fetch("/api/orgs/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness.id,
          name: name.trim(),
          email: email.trim(),
          role
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | ({ data?: { invitation?: { setupLink?: string | null; mailtoUrl?: string | null; requiresPasswordSetup?: boolean; emailDelivery?: boolean | null } } } & ApiError)
        | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to invite member.");
      }

      const requiresPasswordSetup = Boolean(payload?.data?.invitation?.requiresPasswordSetup);
      const emailDelivery = payload?.data?.invitation?.emailDelivery;
      const setupLink = payload?.data?.invitation?.setupLink ?? null;
      const mailtoUrl = payload?.data?.invitation?.mailtoUrl ?? null;
      setLastSetupLink(setupLink);
      setLastSetupMailtoUrl(mailtoUrl);

      setName("");
      setEmail("");
      setRole("CS");
      setIsCreateDialogOpen(false);
      await loadMembers(activeBusiness.id);
      setSuccess(
        requiresPasswordSetup
          ? emailDelivery
            ? "Undangan berhasil dikirim via email."
            : "Undangan dibuat, tapi email belum terkirim. Gunakan link aktivasi sebagai fallback."
          : "Anggota berhasil ditambahkan ke business."
      );
    } catch (submitError) {
      setError(toErrorMessage(submitError, "Failed to invite member."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendSetup(userId: string) {
    if (!activeBusiness || isResendingForUserId) {
      return;
    }

    try {
      setIsResendingForUserId(userId);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/orgs/staff/resend-setup-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness.id,
          userId
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | ({ data?: { setupLink?: string; whatsappDelivery?: boolean | null; emailDelivery?: boolean | null; mailtoUrl?: string | null } } & ApiError)
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to resend setup link.");
      }

      setLastSetupLink(payload?.data?.setupLink ?? null);
      setLastSetupMailtoUrl(payload?.data?.mailtoUrl ?? null);
      if (payload?.data?.emailDelivery === true && payload?.data?.whatsappDelivery === true) {
        setSuccess("Link aktivasi terkirim ulang via email dan WhatsApp.");
      } else if (payload?.data?.emailDelivery === true) {
        setSuccess("Link aktivasi terkirim ulang via email.");
      } else if (payload?.data?.whatsappDelivery === true) {
        setSuccess("Link aktivasi terkirim ulang via WhatsApp.");
      } else {
        setSuccess("Link aktivasi baru siap. Kirimkan lewat email ke staff terkait.");
      }
    } catch (resendError) {
      setError(toErrorMessage(resendError, "Failed to resend setup link."));
    } finally {
      setIsResendingForUserId(null);
    }
  }

  async function handleCopySetupLink() {
    if (!lastSetupLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lastSetupLink);
      setSuccess("Link aktivasi berhasil disalin.");
    } catch {
      setError("Gagal menyalin link aktivasi.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Owner dapat mengundang staff role CS/Advertiser lewat email agar onboarding lebih cepat.</p>
        <p className="text-xs text-muted-foreground">Anggota aktif non-owner: {nonOwnerCount}/{MAX_NON_OWNER_MEMBERS}</p>
      </div>

      {lastSetupLink ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          <p className="break-all">Link aktivasi: {lastSetupLink}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void handleCopySetupLink()}>
              Salin Link
            </Button>
            {lastSetupMailtoUrl ? (
              <Button type="button" size="sm" className="h-8" asChild>
                <a href={lastSetupMailtoUrl}>Buka Email Invite</a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">Loading members...</TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No members found.</TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell className="font-medium text-foreground">{member.name?.trim() || member.email}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{member.role}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateLabel(member.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {member.role !== "OWNER" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open member actions</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Member actions</DropdownMenuLabel>
                          {(member.role === "CS" || member.role === "ADVERTISER") ? (
                            <DropdownMenuItem
                              onClick={() => {
                                void handleResendSetup(member.userId);
                              }}
                              disabled={Boolean(isResendingForUserId)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {isResendingForUserId === member.userId ? "Resending..." : "Resend setup link"}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {reachedLimitForNewMember ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">Batas anggota sudah penuh.</p>
      ) : null}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undang Staff</DialogTitle>
            <DialogDescription>Undang via email dan tentukan role CS/Advertiser. Jika akun belum aktif, sistem menyiapkan link aktivasi.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStaff} className="space-y-3">
            <Input
              id="staff-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama staff"
              className="h-10 rounded-xl"
            />
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@company.com"
              className="h-10 rounded-xl"
            />
            <select
              id="staff-role"
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              {STAFF_ROLES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={!canSubmit}>{isSubmitting ? "Mengundang..." : "Kirim Undangan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
