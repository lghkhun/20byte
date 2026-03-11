"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function BankAccountManager() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [activeOrgId, setActiveOrgId] = useState("");
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(activeOrgId && bankName.trim() && accountNumber.trim() && accountHolder.trim() && !isSubmitting);
  }, [activeOrgId, accountHolder, accountNumber, bankName, isSubmitting]);

  const loadOrganizations = useCallback(async () => {
    const response = await fetch("/api/orgs", { cache: "no-store" });
    const payload = (await response.json()) as { data?: { organizations?: OrgItem[] } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load organizations.");
    }

    const nextOrgs = payload.data?.organizations ?? [];
    setOrgs(nextOrgs);
    if (nextOrgs.length > 0) {
      setActiveOrgId((current) => current || nextOrgs[0].id);
    }
  }, []);

  const loadBankAccounts = useCallback(async (orgId: string) => {
    if (!orgId) {
      setAccounts([]);
      return;
    }

    const response = await fetch(`/api/orgs/bank-accounts?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { data?: { accounts?: BankAccountItem[] } } & ApiError;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to load bank accounts.");
    }

    setAccounts(payload.data?.accounts ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);
        setError(null);
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
      if (!activeOrgId) {
        return;
      }

      try {
        setError(null);
        await loadBankAccounts(activeOrgId);
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
  }, [activeOrgId, loadBankAccounts]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch("/api/orgs/bank-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeOrgId,
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
      await loadBankAccounts(activeOrgId);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to add bank account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(bankAccountId: string) {
    try {
      setError(null);
      const response = await fetch("/api/orgs/bank-accounts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: activeOrgId,
          bankAccountId
        })
      });

      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to delete bank account.");
      }

      await loadBankAccounts(activeOrgId);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete bank account."));
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 rounded-xl border border-border bg-surface/70 p-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bank Transfer Accounts</h1>
        <p className="text-sm text-muted-foreground">Manual transfer destination accounts (max 5 per organization).</p>
      </div>

      <div>
        <label htmlFor="bank-org-selector" className="mb-2 block text-xs text-muted-foreground">
          Organization
        </label>
        <select
          id="bank-org-selector"
          value={activeOrgId}
          onChange={(event) => setActiveOrgId(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleCreate} className="grid gap-2 md:grid-cols-4">
        <input
          value={bankName}
          onChange={(event) => setBankName(event.target.value)}
          placeholder="Bank name"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value)}
          placeholder="Account number"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={accountHolder}
          onChange={(event) => setAccountHolder(event.target.value)}
          placeholder="Account holder"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!canSubmit || accounts.length >= 5}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Add Account"}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">Configured: {accounts.length}/5 accounts.</p>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {!isLoading && accounts.length === 0 ? <p className="text-sm text-muted-foreground">No bank account configured.</p> : null}

      {!isLoading && accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account) => (
            <article key={account.id} className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3">
              <div>
                <p className="text-sm text-foreground">{account.bankName}</p>
                <p className="text-xs text-muted-foreground">{account.accountNumber}</p>
                <p className="text-xs text-muted-foreground">{account.accountHolder}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleDelete(account.id);
                }}
                className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300"
              >
                Delete
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
