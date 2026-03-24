"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { fetchJsonCached, invalidateFetchCache } from "@/lib/client/fetchCache";
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
};

type BankAccountItem = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: string;
};

type ApiError = {
  error?: {
    message?: string;
  };
};

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

export function BankAccountManager() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeBusiness = useMemo(() => orgs[0] ?? null, [orgs]);
  const canSubmit = useMemo(() => Boolean(bankName.trim() && accountNumber.trim() && accountHolder.trim() && !isSubmitting), [accountHolder, accountNumber, bankName, isSubmitting]);
  const createAction = useMemo(
    () => (
      <Button
        type="button"
        disabled={accounts.length >= 5}
        className="h-10 rounded-xl"
        onClick={() => setIsCreateDialogOpen(true)}
      >
        Tambah Rekening
      </Button>
    ),
    [accounts.length]
  );

  useSettingsHeaderAction("20-bank-create", createAction);

  const loadOrganizations = useCallback(async () => {
    const organizations = (await fetchOrganizationsCached()) as OrgItem[];
    setOrgs(organizations);
  }, []);

  const loadBankAccounts = useCallback(async () => {
    const payload = await fetchJsonCached<{ data?: { accounts?: BankAccountItem[] } } & ApiError>("/api/orgs/bank-accounts", {
      ttlMs: 15_000,
      init: { cache: "no-store" }
    });

    setAccounts(payload.data?.accounts ?? []);
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
          setError(toErrorMessage(err, "Failed to initialize bank accounts."));
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

    async function refresh() {
      if (!activeBusiness) {
        return;
      }

      try {
        setError(null);
        setSuccess(null);
        await loadBankAccounts();
      } catch (err) {
        if (mounted) {
          setError(toErrorMessage(err, "Failed to refresh bank accounts."));
        }
      }
    }

    void refresh();

    return () => {
      mounted = false;
    };
  }, [activeBusiness, loadBankAccounts]);

  useEffect(() => {
    if (!error) return;
    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    notifySuccess(success);
  }, [success]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/orgs/bank-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bankName,
          accountNumber,
          accountHolder
        })
      });

      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to add bank account.");
      }

      setBankName("");
      setAccountNumber("");
      setAccountHolder("");
      setIsCreateDialogOpen(false);
      invalidateFetchCache("GET:/api/orgs/bank-accounts");
      await loadBankAccounts();
      setSuccess("Bank account added.");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to add bank account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(bankAccountId: string) {
    try {
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/orgs/bank-accounts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bankAccountId
        })
      });

      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to delete bank account.");
      }

      invalidateFetchCache("GET:/api/orgs/bank-accounts");
      await loadBankAccounts();
      setSuccess("Bank account deleted.");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete bank account."));
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Bank Transfer Accounts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Rekening transfer bisnis yang akan di-snapshot otomatis ke invoice baru. Maksimal 5 rekening.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Configured: {accounts.length}/5 accounts.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>Account Holder</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  Loading bank accounts...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No bank account configured.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium text-foreground">{account.bankName}</TableCell>
                  <TableCell className="text-muted-foreground">{account.accountNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{account.accountHolder}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateLabel(account.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open bank account actions</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Bank account actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => void handleDelete(account.id)} className="text-destructive">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Rekening Bank</DialogTitle>
            <DialogDescription>Tambahkan rekening transfer bisnis untuk invoice baru.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              id="bank-account-bank-name"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="Bank name"
              className="h-10 rounded-xl"
            />
            <Input
              id="bank-account-number"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="Account number"
              className="h-10 rounded-xl"
            />
            <Input
              id="bank-account-holder"
              value={accountHolder}
              onChange={(event) => setAccountHolder(event.target.value)}
              placeholder="Account holder"
              className="h-10 rounded-xl"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={!canSubmit || accounts.length >= 5}>
                {isSubmitting ? "Saving..." : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
