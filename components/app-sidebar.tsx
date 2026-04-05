"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, FileText, LayoutDashboard, Link2, MessageCircle, Shield, Users, Workflow } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SidebarOnboardingCard } from "@/components/onboarding/OwnerOnboardingView";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";
import { fetchJsonCached, invalidateFetchCache } from "@/lib/client/fetchCache";
import { dismissNotify, notifyLoading } from "@/lib/ui/notify";
import type { OwnerOnboardingStatus } from "@/server/services/onboardingService";

type AppSidebarProps = {
  user: {
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    isSuperadmin?: boolean;
    primaryOrgId?: string | null;
    primaryOrgRole?: "OWNER" | "ADMIN" | "CS" | "ADVERTISER" | null;
  } | null;
  ownerOnboardingStatus?: OwnerOnboardingStatus | null;
};

type BillingReminderPayload = {
  data?: {
    reminder?: {
      shouldShowBanner?: boolean;
      message?: string;
    };
  };
};

type BillingChargeItem = {
  id: string;
  status: string;
  requestedAmountCents?: number;
  providerFeeCents?: number | null;
  payableAmountCents?: number;
  totalAmountCents: number;
  paymentMethod: string;
  paymentNumber: string | null;
  expiredAt: string | null;
};

type BillingChargesPayload = {
  data?: {
    charges?: BillingChargeItem[];
  };
};

type BillingCheckoutPayload = {
  data?: {
    charge?: {
      totalAmountCents?: number;
    };
    payment?: {
      amount?: number;
      fee?: number;
      total_payment?: number;
      payment_number?: string;
      payment_method?: string;
      expired_at?: string;
    } | null;
    paymentSummary?: {
      requestedAmountCents?: number;
      providerFeeCents?: number | null;
      payableAmountCents?: number;
    };
  };
  error?: {
    message?: string;
  };
};

function formatIdr(cents: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(cents);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

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

function hasNotExpired(value: string | null | undefined, nowMs = Date.now()): boolean {
  if (!value) {
    return false;
  }

  const expiresAtMs = new Date(value).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > nowMs;
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

export function AppSidebar({ user, ownerOnboardingStatus = null }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [billingReminderMessage, setBillingReminderMessage] = useState<string | null>(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPaymentNumber, setCheckoutPaymentNumber] = useState<string | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<string | null>(null);
  const [checkoutPaymentTotalCents, setCheckoutPaymentTotalCents] = useState<number | null>(null);
  const [, setCheckoutProviderFeeCents] = useState<number | null>(null);
  const [checkoutPaymentExpiresAt, setCheckoutPaymentExpiresAt] = useState<string | null>(null);
  const [checkoutQrDataUrl, setCheckoutQrDataUrl] = useState<string | null>(null);
  const [checkoutNowMs, setCheckoutNowMs] = useState(() => Date.now());
  const loadingToastIdRef = useRef<string | number | null>(null);
  const billingReminderCacheRef = useRef<{ checkedAt: number; message: string | null } | null>(null);

  const navMain = useMemo(
    () => [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard
      },
      {
        title: "Inbox",
        url: "/inbox",
        icon: MessageCircle
      },
      {
        title: "Customers",
        url: "/customers",
        icon: Users
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: FileText
      },
      {
        title: "Shortlink",
        url: "/shortlinks",
        icon: Link2
      },
      {
        title: "CRM Pipeline",
        url: "/crm/pipelines",
        icon: Workflow
      },
      ...(user?.isSuperadmin
        ? [
            {
              title: "Superadmin",
              url: "/sa",
              icon: Shield
            }
          ]
        : [])
    ],
    [user?.isSuperadmin]
  );

  const isOwnerRole = user?.primaryOrgRole === "OWNER";
  const isQrisPayment = (checkoutPaymentMethod ?? "").toLowerCase() === "qris";

  useEffect(() => {
    setPendingPath(null);
    if (loadingToastIdRef.current !== null) {
      dismissNotify(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    if (!user) {
      setBillingReminderMessage(null);
      billingReminderCacheRef.current = null;
      return;
    }

    let active = true;

    async function loadReminder() {
      const cached = billingReminderCacheRef.current;
      const now = Date.now();
      if (cached && now - cached.checkedAt < 60_000) {
        if (active) {
          setBillingReminderMessage(cached.message);
        }
        return;
      }

      try {
        const payload = await fetchJsonCached<BillingReminderPayload>("/api/billing/subscription", {
          ttlMs: 15_000,
          init: { cache: "no-store" }
        });

        const reminder = payload?.data?.reminder;
        const nextMessage = reminder?.shouldShowBanner && reminder.message ? reminder.message : null;
        billingReminderCacheRef.current = { checkedAt: Date.now(), message: nextMessage };
        if (active) {
          setBillingReminderMessage(nextMessage);
        }
      } catch {
        if (active) {
          setBillingReminderMessage(null);
        }
      }
    }

    void loadReminder();
    const interval = window.setInterval(() => {
      void loadReminder();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    let canceled = false;

    async function generateQrDataUrl(value: string) {
      try {
        const qrDataUrl = await QRCode.toDataURL(value, {
          width: 320,
          margin: 1
        });
        if (!canceled) {
          setCheckoutQrDataUrl(qrDataUrl);
        }
      } catch {
        if (!canceled) {
          setCheckoutQrDataUrl(null);
        }
      }
    }

    if (!checkoutPaymentNumber || !isQrisPayment) {
      setCheckoutQrDataUrl(null);
      return () => {
        canceled = true;
      };
    }

    void generateQrDataUrl(checkoutPaymentNumber);
    return () => {
      canceled = true;
    };
  }, [checkoutPaymentNumber, isQrisPayment]);

  useEffect(() => {
    if (!isCheckoutDialogOpen || !checkoutPaymentExpiresAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCheckoutNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isCheckoutDialogOpen, checkoutPaymentExpiresAt]);

  function applyCheckoutPayment(input: {
    paymentNumber: string | null;
    paymentMethod: string | null;
    totalAmountCents: number | null;
    providerFeeCents: number | null;
    expiredAt: string | null;
  }) {
    setCheckoutPaymentNumber(input.paymentNumber);
    setCheckoutPaymentMethod(input.paymentMethod);
    setCheckoutPaymentTotalCents(input.totalAmountCents);
    setCheckoutProviderFeeCents(input.providerFeeCents);
    setCheckoutPaymentExpiresAt(input.expiredAt);
    setCheckoutNowMs(Date.now());
  }

  async function handleOpenBillingCheckout() {
    if (!isOwnerRole) {
      router.push("/billing");
      return;
    }

    setIsCheckoutDialogOpen(true);
    setIsCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const chargesPayload = await fetchJsonCached<BillingChargesPayload>("/api/billing/charges", {
        ttlMs: 1_500,
        init: { cache: "no-store" }
      });
      const latestPending = (chargesPayload?.data?.charges ?? []).find(
        (charge) => charge.status === "PENDING" && Boolean(charge.paymentNumber) && hasNotExpired(charge.expiredAt)
      );

      if (latestPending) {
        applyCheckoutPayment({
          paymentNumber: latestPending.paymentNumber,
          paymentMethod: latestPending.paymentMethod,
          totalAmountCents: latestPending.payableAmountCents ?? latestPending.totalAmountCents,
          providerFeeCents: latestPending.providerFeeCents ?? null,
          expiredAt: latestPending.expiredAt
        });
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentMethod: "qris" })
      });
      const payload = (await response.json().catch(() => null)) as BillingCheckoutPayload | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal menyiapkan checkout.");
      }

      applyCheckoutPayment({
        paymentNumber: payload?.data?.payment?.payment_number ?? null,
        paymentMethod: payload?.data?.payment?.payment_method ?? null,
        totalAmountCents:
          payload?.data?.paymentSummary?.payableAmountCents ??
          payload?.data?.payment?.total_payment ??
          payload?.data?.charge?.totalAmountCents ??
          null,
        providerFeeCents:
          payload?.data?.paymentSummary?.providerFeeCents ??
          (typeof payload?.data?.payment?.fee === "number" ? payload.data.payment.fee : null),
        expiredAt: payload?.data?.payment?.expired_at ?? null
      });

      invalidateFetchCache("GET:/api/billing/subscription");
      invalidateFetchCache("GET:/api/billing/charges");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Gagal menyiapkan checkout.");
    } finally {
      setIsCheckoutLoading(false);
    }
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="20byte">
              <Link href="/inbox">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="text-xs font-semibold">20</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">20byte</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Chat-first CRM</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          currentPath={pathname}
          pendingPath={pendingPath}
          onNavigateStart={(url) => {
            setPendingPath(url);
            if (loadingToastIdRef.current !== null) {
              dismissNotify(loadingToastIdRef.current);
            }
            loadingToastIdRef.current = notifyLoading("Sedang memuat halaman...");
          }}
          items={navMain.map((item) => ({ ...item, isActive: pathname === item.url || pathname.startsWith(`${item.url}/`) }))}
        />
      </SidebarContent>
      <SidebarFooter>
        {billingReminderMessage && isOwnerRole ? (
          <button
            type="button"
            onClick={() => {
              void handleOpenBillingCheckout();
            }}
            className="group relative mx-3 mb-3 w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <p className="flex items-center gap-2 text-[13px] font-bold text-primary">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[11px]">✨</span>
                Suka platform kami?
              </p>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-foreground/80">
                Berlangganan sekarang untuk terus menggunakan fitur tanpa henti.
              </p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-primary/80 transition-colors group-hover:text-primary">
                Tampilkan QRIS &rarr;
              </p>
            </div>
          </button>
        ) : null}
        {billingReminderMessage && !isOwnerRole ? (
          <div className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 px-4 py-3 text-left">
            <p className="flex items-center gap-2 text-[13px] font-bold text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Masa Trial Segera Habis
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-amber-900/80">
              Beri tahu Owner workspace Anda untuk segera melakukan perpanjangan.
            </p>
          </div>
        ) : null}
        {ownerOnboardingStatus && !ownerOnboardingStatus.isComplete ? (
          <div className="mx-2">
            <SidebarOnboardingCard status={ownerOnboardingStatus} />
          </div>
        ) : null}
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail side="left" />

      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-[420px] p-6 rounded-[24px] gap-0">
          <DialogHeader className="space-y-1.5 pb-2">
            <DialogTitle className="text-[18px] font-bold text-foreground">Scan QR Pembayaran</DialogTitle>
            <DialogDescription className="text-[13px] font-medium leading-relaxed text-muted-foreground/80">
              Gunakan aplikasi e-wallet atau mobile banking untuk menyelesaikan pembayaran.
            </DialogDescription>
          </DialogHeader>

          {isCheckoutLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">Menyiapkan QR Pembayaran...</p>
            </div>
          ) : null}

          {!isCheckoutLoading && checkoutError ? (
            <div className="py-4 space-y-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-600">
                {checkoutError}
              </div>
              <Button
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => {
                  router.push("/billing");
                  setIsCheckoutDialogOpen(false);
                }}
              >
                Buka Halaman Billing
              </Button>
            </div>
          ) : null}

          {!isCheckoutLoading && !checkoutError ? (
            <div className="py-2">
              <div className="flex flex-col items-center pb-6 pt-4">
                {checkoutQrDataUrl && isQrisPayment ? (
                  <div className="flex items-center justify-center rounded-[20px] border border-border/40 bg-white p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]">
                    <Image src={checkoutQrDataUrl} alt="QR pembayaran" width={280} height={280} unoptimized className="object-contain" />
                  </div>
                ) : (
                  <div className="flex h-[280px] w-[280px] items-center justify-center rounded-[20px] border border-dashed border-border/50 bg-muted/20">
                    <p className="text-[13px] font-medium text-muted-foreground text-center px-6">
                      Menyiapkan tautan bayar...<br />Dialihkan ke halaman billing jika gagal.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-muted-foreground/80">Nominal bayar:</span>
                  <span className="text-[14px] font-bold tracking-tight text-foreground">{formatIdr(checkoutPaymentTotalCents ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-muted-foreground/80">Sisa waktu bayar:</span>
                  <span className="text-[13px] font-bold text-amber-600 tracking-tight">{formatCountdown(checkoutPaymentExpiresAt, checkoutNowMs)}</span>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                Expired: {formatDate(checkoutPaymentExpiresAt)}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
