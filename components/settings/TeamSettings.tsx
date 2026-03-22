"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, PencilLine } from "lucide-react";

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
const ASSIGNABLE_ROLES = ["ADMIN", "CS", "ADVERTISER"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("ADMIN");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const nonOwnerCount = useMemo(() => members.filter((member) => member.role !== "OWNER").length, [members]);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isExistingMemberEmail = useMemo(() => members.some((member) => member.email.toLowerCase() === normalizedEmail), [members, normalizedEmail]);
  const reachedLimitForNewMember = nonOwnerCount >= MAX_NON_OWNER_MEMBERS && !isExistingMemberEmail;
  const canSubmit = Boolean(activeBusiness && normalizedEmail && !isSubmitting && !reachedLimitForNewMember);
  const createAction = useMemo(
    () => (
      <Button
        type="button"
        disabled={reachedLimitForNewMember}
        className="h-10 rounded-xl"
        onClick={() => {
          setEditingMember(null);
          setEmail("");
          setRole("ADMIN");
          setIsCreateDialogOpen(true);
        }}
      >
        Tambah Member
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

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !activeBusiness) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/orgs/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeBusiness.id,
          email: normalizedEmail,
          role
        })
      });
      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to save team member.");
      }

      setEmail("");
      setEditingMember(null);
      setIsCreateDialogOpen(false);
      await loadMembers(activeBusiness.id);
      setSuccess(isExistingMemberEmail ? "Member role updated." : "Member added.");
    } catch (submitError) {
      setError(toErrorMessage(submitError, "Failed to save team member."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Maksimal {MAX_NON_OWNER_MEMBERS} anggota non-owner per business. Role anggota yang ada bisa diupdate dari tabel.
        </p>
        <p className="text-xs text-muted-foreground">
          Anggota aktif tanpa owner: {nonOwnerCount}/{MAX_NON_OWNER_MEMBERS}
        </p>
      </div>

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
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  Loading members...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No members found.
                </TableCell>
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
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingMember(member);
                              setEmail(member.email);
                              setRole((ASSIGNABLE_ROLES.includes(member.role as AssignableRole) ? member.role : "ADMIN") as AssignableRole);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Edit role
                          </DropdownMenuItem>
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
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          Batas anggota sudah penuh. Edit role anggota yang sudah ada jika perlu.
        </p>
      ) : null}

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setEditingMember(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Role Member" : "Tambah Member"}</DialogTitle>
            <DialogDescription>
              {editingMember ? "Perbarui role anggota yang sudah ada." : "Tambahkan anggota baru ke business aktif."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-3">
            <Input
              id="team-member-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@company.com"
              className="h-10 rounded-xl"
              disabled={Boolean(editingMember)}
            />
            <select
              id="team-member-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              {ASSIGNABLE_ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setEditingMember(null);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? "Saving..." : editingMember ? "Update Member" : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
