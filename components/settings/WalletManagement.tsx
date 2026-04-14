"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WalletSummaryResponse = {
  data?: {
    summary?: {
      orgId: string;
      orgName: string;
      walletBalanceCents: number;
      ledgers: Array<{
        id: string;
        type: string;
        direction: string;
        amountCents: number;
        balanceAfterCents: number;
        referenceType: string;
        referenceId: string;
        createdAt: string;
      }>;
    };
  };
  error?: { message?: string };
};

type WalletTopupResponse = {
  data?: {
    topups?: Array<{
      id: string;
      status: string;
      amountCents: number;
      customerPayableCents: number;
      paymentMethod: string;
      paymentNumber: string | null;
      expiresAt: string | null;
      createdAt: string;
    }>;
    topup?: {
      id: string;
      status: string;
      amountCents: number;
      customerPayableCents: number;
      paymentMethod: string;
      paymentNumber: string | null;
      expiresAt: string | null;
      createdAt: string;
    };
  };
  error?: { message?: string };
};

type WithdrawResponse = {
  data?: {
    requests?: Array<{
      id: string;
      amountCents: number;
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      status: string;
      createdAt: string;
    }>;
    request?: {
      id: string;
      amountCents: number;
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      status: string;
      createdAt: string;
    };
  };
  error?: { message?: string };
};

function formatIdr(cents: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Math.max(0, cents));
}

function formatDate(value: string): string {
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

export function WalletManagement() {
  const [balanceCents, setBalanceCents] = useState(0);
  const [topups, setTopups] = useState<NonNullable<WalletTopupResponse["data"]>["topups"]>([]);
  const [withdrawals, setWithdrawals] = useState<NonNullable<WithdrawResponse["data"]>["requests"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState("100000");
  const [topupMethod, setTopupMethod] = useState("qris");
  const [withdrawAmount, setWithdrawAmount] = useState("50000");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawHolder, setWithdrawHolder] = useState("");
  const [isSubmittingTopup, setIsSubmittingTopup] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, topupsRes, withdrawalsRes] = await Promise.all([
        fetch("/api/wallet/summary", { cache: "no-store" }),
        fetch("/api/wallet/topups", { cache: "no-store" }),
        fetch("/api/wallet/withdrawals", { cache: "no-store" })
      ]);

      const summaryPayload = (await summaryRes.json().catch(() => null)) as WalletSummaryResponse | null;
      const topupPayload = (await topupsRes.json().catch(() => null)) as WalletTopupResponse | null;
      const withdrawalPayload = (await withdrawalsRes.json().catch(() => null)) as WithdrawResponse | null;

      if (!summaryRes.ok || !summaryPayload?.data?.summary) {
        throw new Error(summaryPayload?.error?.message ?? "Gagal memuat ringkasan wallet.");
      }
      if (!topupsRes.ok) {
        throw new Error(topupPayload?.error?.message ?? "Gagal memuat riwayat topup.");
      }
      if (!withdrawalsRes.ok) {
        throw new Error(withdrawalPayload?.error?.message ?? "Gagal memuat riwayat withdraw.");
      }

      setBalanceCents(summaryPayload.data.summary.walletBalanceCents);
      setTopups(topupPayload?.data?.topups ?? []);
      setWithdrawals(withdrawalPayload?.data?.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data wallet.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTopup() {
    try {
      setIsSubmittingTopup(true);
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/wallet/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Number(topupAmount),
          paymentMethod: topupMethod
        })
      });
      const payload = (await response.json().catch(() => null)) as WalletTopupResponse | null;
      if (!response.ok || !payload?.data?.topup) {
        throw new Error(payload?.error?.message ?? "Gagal membuat topup.");
      }

      setSuccess("Topup berhasil dibuat. Lanjutkan pembayaran sesuai nomor tujuan.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal membuat topup.");
    } finally {
      setIsSubmittingTopup(false);
    }
  }

  async function handleWithdraw() {
    try {
      setIsSubmittingWithdraw(true);
      setError(null);
      setSuccess(null);
      const response = await fetch("/api/wallet/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Number(withdrawAmount),
          bankName: withdrawBank,
          accountNumber: withdrawAccount,
          accountHolder: withdrawHolder
        })
      });
      const payload = (await response.json().catch(() => null)) as WithdrawResponse | null;
      if (!response.ok || !payload?.data?.request) {
        throw new Error(payload?.error?.message ?? "Gagal membuat request withdraw.");
      }

      setSuccess("Request withdraw berhasil dibuat dan menunggu proses admin.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal membuat request withdraw.");
    } finally {
      setIsSubmittingWithdraw(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Wallet Bisnis</h3>
        <p className="text-sm text-muted-foreground">Kelola saldo untuk menanggung biaya payment gateway dan withdraw dana.</p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Memuat wallet...</p> : null}

      {!isLoading ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">Saldo tersedia</p>
            <p className="text-2xl font-bold text-foreground">{formatIdr(balanceCents)}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-sm font-semibold text-foreground">Topup Saldo</p>
              <Input value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} placeholder="Nominal cents" />
              <select value={topupMethod} onChange={(event) => setTopupMethod(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="qris">QRIS</option>
                <option value="bni_va">BNI VA</option>
                <option value="bri_va">BRI VA</option>
              </select>
              <Button type="button" onClick={() => void handleTopup()} disabled={isSubmittingTopup}>
                {isSubmittingTopup ? "Memproses..." : "Buat Topup"}
              </Button>
            </div>

            <div className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-sm font-semibold text-foreground">Withdraw Saldo</p>
              <Input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="Nominal cents" />
              <Input value={withdrawBank} onChange={(event) => setWithdrawBank(event.target.value)} placeholder="Nama bank" />
              <Input value={withdrawAccount} onChange={(event) => setWithdrawAccount(event.target.value)} placeholder="Nomor rekening" />
              <Input value={withdrawHolder} onChange={(event) => setWithdrawHolder(event.target.value)} placeholder="Atas nama" />
              <Button type="button" variant="secondary" onClick={() => void handleWithdraw()} disabled={isSubmittingWithdraw}>
                {isSubmittingWithdraw ? "Memproses..." : "Buat Request Withdraw"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">Riwayat Topup</p>
              <div className="space-y-2">
                {topups?.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs">
                    <p className="font-medium">{item.paymentMethod.toUpperCase()} • {item.status}</p>
                    <p>{formatIdr(item.customerPayableCents)} • {formatDate(item.createdAt)}</p>
                    {item.paymentNumber ? <p>Tujuan: {item.paymentNumber}</p> : null}
                  </div>
                ))}
                {(topups?.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">Belum ada topup.</p> : null}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">Riwayat Withdraw</p>
              <div className="space-y-2">
                {withdrawals?.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs">
                    <p className="font-medium">{item.bankName} • {item.status}</p>
                    <p>{formatIdr(item.amountCents)} • {formatDate(item.createdAt)}</p>
                    <p>{item.accountHolder} ({item.accountNumber})</p>
                  </div>
                ))}
                {(withdrawals?.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">Belum ada withdraw.</p> : null}
              </div>
            </div>
          </div>

          {error ? <p className="rounded-md border border-rose-300/70 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="rounded-md border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
