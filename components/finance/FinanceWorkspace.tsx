"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDownToLine, Plus, Wallet } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dismissNotify, notifyError, notifyLoading, notifySuccess } from "@/lib/ui/notify";

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

type HistoryRow = {
  id: string;
  status: string;
  type: "TOPUP" | "WITHDRAW";
  channel: string;
  amountCents: number;
  createdAt: string;
  detail: string;
};

function formatIdr(cents: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Math.max(0, cents));
}

function formatDate(value: string | null): string {
  if (!value) return "-";
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

function formatCountdown(value: string | null | undefined, nowMs: number): string {
  if (!value) {
    return "-";
  }
  const expiresAtMs = new Date(value).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return "-";
  }
  const remainingMs = Math.max(0, expiresAtMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function normalizeMethod(value: string): string {
  return value.replace(/_/g, " ").toUpperCase();
}

export function FinanceWorkspace() {
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceCents, setBalanceCents] = useState(0);
  const [topups, setTopups] = useState<NonNullable<WalletTopupResponse["data"]>["topups"]>([]);
  const [withdrawals, setWithdrawals] = useState<NonNullable<WithdrawResponse["data"]>["requests"]>([]);
  const [showTopupDialog, setShowTopupDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showPaymentInfoDialog, setShowPaymentInfoDialog] = useState(false);
  
  const [isTopupSubmitting, setIsTopupSubmitting] = useState(false);
  const [isWithdrawSubmitting, setIsWithdrawSubmitting] = useState(false);
  
  const [topupAmount, setTopupAmount] = useState("100000");
  const [topupMethod, setTopupMethod] = useState("qris");
  
  const [withdrawAmount, setWithdrawAmount] = useState("50000");
  const [withdrawBankName, setWithdrawBankName] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawAccountHolder, setWithdrawAccountHolder] = useState("");
  
  const [createdPaymentDetails, setCreatedPaymentDetails] = useState<{
    paymentMethod: string;
    paymentNumber: string;
    expiredAt: string | null;
    totalAmountCents: number;
  } | null>(null);
  const [topupQrDataUrl, setTopupQrDataUrl] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, topupRes, withdrawRes] = await Promise.all([
        fetch("/api/wallet/summary", { cache: "no-store" }),
        fetch("/api/wallet/topups", { cache: "no-store" }),
        fetch("/api/wallet/withdrawals", { cache: "no-store" })
      ]);

      if (summaryRes.status === 403 || topupRes.status === 403 || withdrawRes.status === 403) {
        setIsForbidden(true);
        return;
      }

      const summaryPayload = (await summaryRes.json().catch(() => null)) as WalletSummaryResponse | null;
      const topupPayload = (await topupRes.json().catch(() => null)) as WalletTopupResponse | null;
      const withdrawPayload = (await withdrawRes.json().catch(() => null)) as WithdrawResponse | null;

      if (!summaryRes.ok || !summaryPayload?.data?.summary) {
        throw new Error(summaryPayload?.error?.message ?? "Gagal memuat ringkasan wallet.");
      }
      if (!topupRes.ok) {
        throw new Error(topupPayload?.error?.message ?? "Gagal memuat riwayat topup.");
      }
      if (!withdrawRes.ok) {
        throw new Error(withdrawPayload?.error?.message ?? "Gagal memuat riwayat withdraw.");
      }

      setIsForbidden(false);
      setBalanceCents(summaryPayload.data.summary.walletBalanceCents);
      setTopups(topupPayload?.data?.topups ?? []);
      setWithdrawals(withdrawPayload?.data?.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data finance.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData();
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadData]);

  useEffect(() => {
    let canceled = false;
    async function generateQr(number: string) {
       try {
         const url = await QRCode.toDataURL(number, { width: 320, margin: 1 });
         if (!canceled) setTopupQrDataUrl(url);
       } catch {
         if (!canceled) setTopupQrDataUrl(null);
       }
    }

    if (createdPaymentDetails?.paymentMethod.toLowerCase() === "qris" && createdPaymentDetails.paymentNumber) {
      void generateQr(createdPaymentDetails.paymentNumber);
    } else {
      setTopupQrDataUrl(null);
    }

    return () => { canceled = true };
  }, [createdPaymentDetails]);

  useEffect(() => {
    if (!showPaymentInfoDialog) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showPaymentInfoDialog]);

  const pendingSettlementCents = useMemo(
    () =>
      (topups ?? [])
        .filter((item) => item.status === "PENDING")
        .reduce((total, item) => total + item.customerPayableCents, 0),
    [topups]
  );

  const inProcessWithdrawCents = useMemo(
    () =>
      (withdrawals ?? [])
        .filter((item) => item.status === "PENDING" || item.status === "APPROVED")
        .reduce((total, item) => total + item.amountCents, 0),
    [withdrawals]
  );

  const totalWithdrawnCents = useMemo(
    () =>
      (withdrawals ?? [])
        .filter((item) => item.status === "PAID")
        .reduce((total, item) => total + item.amountCents, 0),
    [withdrawals]
  );

  const historyRows = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = [];
    for (const topup of topups ?? []) {
      rows.push({
        id: `topup:${topup.id}`,
        status: topup.status,
        type: "TOPUP",
        channel: normalizeMethod(topup.paymentMethod),
        amountCents: topup.customerPayableCents,
        createdAt: topup.createdAt,
        detail: topup.paymentNumber ? `Tujuan: ${topup.paymentNumber}` : "-"
      });
    }
    for (const item of withdrawals ?? []) {
      rows.push({
        id: `withdraw:${item.id}`,
        status: item.status,
        type: "WITHDRAW",
        channel: item.bankName || "-",
        amountCents: item.amountCents,
        createdAt: item.createdAt,
        detail: `${item.accountHolder} (${item.accountNumber})`
      });
    }
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  }, [topups, withdrawals]);

  async function handleCreateTopup() {
    const amountCents = Number(topupAmount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      notifyError("Nominal topup tidak valid.");
      return;
    }

    const toastId = notifyLoading("Membuat request topup...");
    setIsTopupSubmitting(true);
    try {
      const response = await fetch("/api/wallet/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, paymentMethod: topupMethod })
      });

      const payload = (await response.json().catch(() => null)) as WalletTopupResponse | null;
      if (!response.ok || !payload?.data?.topup) {
        throw new Error(payload?.error?.message ?? "Gagal membuat topup.");
      }

      dismissNotify(toastId);
      notifySuccess("Topup berhasil dibuat.");
      setShowTopupDialog(false);
      
      const charge = payload.data.topup;
      if (charge.paymentNumber) {
         setCreatedPaymentDetails({
           paymentMethod: charge.paymentMethod,
           paymentNumber: charge.paymentNumber,
           totalAmountCents: charge.customerPayableCents,
           expiredAt: charge.expiresAt
         });
         setShowPaymentInfoDialog(true);
      }
      
      await loadData();
    } catch (submitError) {
      dismissNotify(toastId);
      notifyError(submitError instanceof Error ? submitError.message : "Gagal membuat topup.");
    } finally {
      setIsTopupSubmitting(false);
    }
  }

  async function handleCreateWithdraw() {
    const amountCents = Number(withdrawAmount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      notifyError("Nominal withdraw tidak valid.");
      return;
    }

    const toastId = notifyLoading("Membuat request withdraw...");
    setIsWithdrawSubmitting(true);
    try {
      const response = await fetch("/api/wallet/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          bankName: withdrawBankName,
          accountNumber: withdrawAccountNumber,
          accountHolder: withdrawAccountHolder
        })
      });

      const payload = (await response.json().catch(() => null)) as WithdrawResponse | null;
      if (!response.ok || !payload?.data?.request) {
        throw new Error(payload?.error?.message ?? "Gagal membuat request withdraw.");
      }

      dismissNotify(toastId);
      notifySuccess("Request withdraw berhasil dibuat.");
      setShowWithdrawDialog(false);
      await loadData();
    } catch (submitError) {
      dismissNotify(toastId);
      notifyError(submitError instanceof Error ? submitError.message : "Gagal membuat request withdraw.");
    } finally {
      setIsWithdrawSubmitting(false);
    }
  }

  if (isForbidden) {
    return (
      <div className="w-full flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Menu Finance hanya bisa diakses oleh role owner.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-5">
        <header className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola saldo e-payment, topup, withdraw, dan riwayat transaksi.</p>
        </header>

        {isLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-[200px] w-full rounded-2xl" />
            <Skeleton className="h-[200px] w-full rounded-2xl" />
            <Skeleton className="h-[120px] w-full rounded-2xl xl:col-span-2" />
          </div>
        ) : null}

        {!isLoading ? (
          <>
            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-5 shadow-sm">
                <p className="text-sm font-semibold text-emerald-800">Saldo E-Payment</p>
                <p className="mt-1 text-4xl font-black tracking-tight text-emerald-950">{formatIdr(balanceCents)}</p>

                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-white/60 backdrop-blur-md px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 font-medium">Pending settlement</span>
                    <span className="font-bold text-emerald-900">{formatIdr(pendingSettlementCents)}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button type="button" variant="outline" className="border-emerald-500/30 bg-white text-emerald-800 hover:bg-emerald-50" onClick={() => setShowWithdrawDialog(true)}>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Tarik Saldo
                  </Button>
                  <Button type="button" className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)]" onClick={() => setShowTopupDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Saldo
                  </Button>
                </div>
              </article>

              <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Saldo Bank Transfer</p>
                <p className="mt-1 text-4xl font-black tracking-tight text-foreground">{formatIdr(0)}</p>
                <div className="mt-4 rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  <p>• Dana bank transfer manual tetap masuk ke rekening bisnis Anda.</p>
                  <p>• Saldo e-payment dipakai untuk biaya gateway yang ditanggung merchant.</p>
                </div>
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Total Saldo Ditarik</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{formatIdr(totalWithdrawnCents)}</p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Dalam Proses</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{formatIdr(inProcessWithdrawCents)}</p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Total Disbursement</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{formatIdr(totalWithdrawnCents)}</p>
              </article>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <header className="border-b border-border/70 bg-muted/20 px-5 py-4">
                <p className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                  <Wallet className="h-5 w-5 text-emerald-500" />
                  Riwayat Transaksi
                </p>
                <p className="text-sm text-muted-foreground pt-1">Daftar transaksi e-payment terbaru.</p>
              </header>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-5 py-3 font-semibold">Settlement Status & Time</th>
                      <th className="px-5 py-3 font-semibold">Reference ID</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Channel</th>
                      <th className="px-5 py-3 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} className="border-t border-border/60 transition hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-foreground">{row.status}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{row.detail}</td>
                        <td className="px-5 py-3 font-semibold text-foreground">
                           <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${row.type === 'TOPUP' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                             {row.type}
                           </span>
                        </td>
                        <td className="px-5 py-3">{row.channel}</td>
                        <td className="px-5 py-3 font-semibold text-foreground text-right">{formatIdr(row.amountCents)}</td>
                      </tr>
                    ))}
                    {historyRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                          Tidak ada data transaksi.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
      </div>

      <Dialog open={showTopupDialog} onOpenChange={setShowTopupDialog}>
        <DialogContent className="max-w-[480px] p-0 border-border/60 rounded-[24px] overflow-hidden">
          <div className="bg-white">
            <DialogHeader className="border-b border-border/50 px-6 py-6 bg-muted/20">
              <DialogTitle className="text-2xl font-bold tracking-tight text-emerald-900">Tambah Saldo</DialogTitle>
              <DialogDescription className="text-[15px] font-medium text-emerald-700/80 mt-1">
                Topup saldo e-payment untuk biaya transaksi.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-6 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Nominal Topup</span>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-medium text-slate-400">Rp</div>
                  <Input
                    value={topupAmount}
                    onChange={(event) => setTopupAmount(event.target.value)}
                    placeholder="Contoh: 100000"
                    type="number"
                    min={0}
                    className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-11 pr-4 text-[15px] shadow-sm transition-all focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                  />
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Metode Pembayaran</span>
                <select
                  value={topupMethod}
                  onChange={(event) => setTopupMethod(event.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm transition-all focus-visible:outline-none focus-visible:border-emerald-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                >
                  <option value="qris">QRIS</option>
                  <option value="bni_va">BNI VA</option>
                  <option value="bri_va">BRI VA</option>
                </select>
              </label>
              
              <div className="pt-2">
                <Button type="button" className="w-full h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[15px] shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] transition-all" onClick={() => void handleCreateTopup()} disabled={isTopupSubmitting}>
                  Buat Topup
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showPaymentInfoDialog} onOpenChange={setShowPaymentInfoDialog}>
        <DialogContent className="sm:max-w-[420px] p-6 rounded-[28px] gap-0 border-emerald-500/20 shadow-2xl">
          <DialogHeader className="space-y-1.5 pb-2">
            <DialogTitle className="text-[20px] font-bold text-slate-800 text-center">Scan Pembayaran</DialogTitle>
            <DialogDescription className="text-[13px] font-medium leading-relaxed text-slate-500 text-center">
              Segera selesaikan pembayaran sesuai instruksi.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex flex-col items-center pb-6 pt-4">
              {createdPaymentDetails?.paymentMethod.toLowerCase() === "qris" ? (
                 <div className="flex items-center justify-center rounded-[24px] border border-emerald-100 bg-emerald-50 p-4 shadow-lg shadow-emerald-500/5">
                   {topupQrDataUrl ? <Image src={topupQrDataUrl} alt="QR pembayaran" width={280} height={280} unoptimized className="object-contain rounded-xl" /> : <div className="h-[280px] w-[280px] bg-emerald-100/50 animate-pulse rounded-xl" />}
                 </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 w-full text-center shadow-lg shadow-emerald-500/5">
                   <p className="text-[13px] font-bold text-emerald-800 uppercase tracking-wider mb-2">Virtual Account</p>
                   <p className="text-2xl font-black tracking-tight text-emerald-950">{createdPaymentDetails?.paymentNumber}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-4 space-y-2.5">
               <div className="flex items-center justify-between">
                 <span className="text-[13px] font-semibold text-slate-500">Total Tagihan:</span>
                 <span className="text-[15px] font-bold tracking-tight text-emerald-700">{formatIdr(createdPaymentDetails?.totalAmountCents ?? 0)}</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[13px] font-semibold text-slate-500">Metode:</span>
                 <span className="text-[13px] font-bold text-slate-800">{normalizeMethod(createdPaymentDetails?.paymentMethod ?? "")}</span>
               </div>
               {createdPaymentDetails?.expiredAt ? (
                 <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 mt-2.5">
                   <span className="text-[13px] font-semibold text-slate-500">Sisa waktu:</span>
                   <span className="text-[13px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">{formatCountdown(createdPaymentDetails.expiredAt, nowMs)}</span>
                 </div>
               ) : null}
            </div>
            
            <div className="mt-5">
              <Button type="button" variant="outline" className="w-full h-12 rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-[15px]" onClick={() => { setShowPaymentInfoDialog(false); void loadData(); }}>
                Tutup Peringatan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="max-w-[480px] p-0 border-border/60 rounded-[24px] overflow-hidden">
          <div className="bg-white">
            <DialogHeader className="border-b border-border/50 px-6 py-6 bg-muted/20">
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-800">Tarik Saldo</DialogTitle>
              <DialogDescription className="text-[15px] font-medium text-slate-500 mt-1">Withdraw saldo e-payment ke rekening bisnis Anda.</DialogDescription>
            </DialogHeader>
            <div className="px-6 py-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Nominal Tarik Saldo</span>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-medium text-slate-400">Rp</div>
                  <Input
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="Contoh: 50000"
                    type="number"
                    min={0}
                    className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-11 pr-4 text-[15px] shadow-sm transition-all focus-visible:border-sky-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-sky-500/10"
                  />
                </div>
              </label>
              <label className="block space-y-2">
                 <span className="text-sm font-semibold text-slate-700">Nama Bank</span>
                 <Input
                   value={withdrawBankName}
                   onChange={(event) => setWithdrawBankName(event.target.value)}
                   placeholder="Contoh: BCA"
                   className="h-12 rounded-xl border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm focus-visible:border-sky-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-sky-500/10"
                 />
              </label>
              <label className="block space-y-2">
                 <span className="text-sm font-semibold text-slate-700">Nomor Rekening</span>
                 <Input
                   value={withdrawAccountNumber}
                   onChange={(event) => setWithdrawAccountNumber(event.target.value)}
                   placeholder="Nomor rekening tujuan"
                   className="h-12 rounded-xl border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm focus-visible:border-sky-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-sky-500/10"
                 />
              </label>
              <label className="block space-y-2">
                 <span className="text-sm font-semibold text-slate-700">Atas Nama</span>
                 <Input
                   value={withdrawAccountHolder}
                   onChange={(event) => setWithdrawAccountHolder(event.target.value)}
                   placeholder="Nama pemilik rekening"
                   className="h-12 rounded-xl border-slate-200 bg-slate-50/50 px-4 text-[15px] shadow-sm focus-visible:border-sky-500/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-sky-500/10"
                 />
              </label>
              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 font-bold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] transition-all text-[15px]"
                  onClick={() => void handleCreateWithdraw()}
                  disabled={isWithdrawSubmitting}
                >
                  Buat Request Withdraw
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
