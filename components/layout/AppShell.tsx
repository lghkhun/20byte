"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { fetchJsonCached } from "@/lib/client/fetchCache";
import type { OwnerOnboardingStatus } from "@/server/services/onboardingService";

type AppShellProps = {
  user: {
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    isSuperadmin?: boolean;
    primaryOrgId?: string | null;
    primaryOrgRole?: "OWNER" | "ADMIN" | "CS" | "ADVERTISER" | null;
  } | null;
  ownerOnboardingStatus?: OwnerOnboardingStatus | null;
  children: React.ReactNode;
};

/* ── Scroll-aware public header ── */
function PublicLayout({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    function onScroll() {
      if (!header) return;
      if (window.scrollY > 20) {
        header.classList.add("header-scrolled");
      } else {
        header.classList.remove("header-scrolled");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen">
      <header
        ref={headerRef}
        className="landing-header fixed left-0 right-0 top-0 z-50 flex h-20 items-center justify-between px-6 transition-all duration-500 md:px-12"
      >
        <Link className="text-lg font-black tracking-tighter text-foreground" href="/">
          20byte.
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {pathname !== "/login" && (
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-transparent px-5 text-sm font-semibold text-foreground transition-all duration-300 hover:bg-foreground/5"
            >
              Login
            </Link>
          )}
          {pathname !== "/register" && (
            <Link
              href="/register"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_4px_14px_hsl(var(--primary)/0.3)] transition-all duration-300 hover:scale-105 hover:bg-primary/90 hover:shadow-[0_6px_20px_hsl(var(--primary)/0.4)]"
            >
              Mulai Trial
            </Link>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

const publicRoutes = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/register",
  "/set-password",
  "/privacy",
  "/terms",
  "/faq",
  "/developers/whatsapp-api"
]);

export function AppShell({ user, ownerOnboardingStatus = null, children }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const lastLockStateRef = useRef<{ checkedAt: number; isLocked: boolean } | null>(null);

  const isPublicInvoiceRoute = pathname.startsWith("/i/");
  const isPublicDeveloperRoute = pathname.startsWith("/developers/");
  const isPublicRoute = publicRoutes.has(pathname) || isPublicInvoiceRoute || isPublicDeveloperRoute;

  useEffect(() => {
    if (!user || isPublicRoute) {
      return;
    }

    if (user.primaryOrgRole !== "OWNER") {
      return;
    }

    const billingAllowedRoutes = ["/billing", "/settings/profile"];
    if (billingAllowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
      return;
    }

    const now = Date.now();
    const cached = lastLockStateRef.current;
    if (cached && now - cached.checkedAt < 30_000) {
      if (cached.isLocked) {
        router.replace("/billing");
      }
      return;
    }

    let active = true;

    async function checkBillingLock() {
      try {
        const payload = await fetchJsonCached<{ data?: { state?: { isLocked?: boolean } } }>(
          "/api/billing/subscription",
          {
            ttlMs: 15_000,
            init: { cache: "no-store" }
          }
        );

        const isLocked = Boolean(payload?.data?.state?.isLocked);
        lastLockStateRef.current = { checkedAt: Date.now(), isLocked };

        if (active && isLocked) {
          router.replace("/billing");
        }
      } catch {
        // no-op: avoid disrupting navigation on transient fetch failures.
      }
    }

    void checkBillingLock();

    return () => {
      active = false;
    };
  }, [isPublicRoute, pathname, router, user]);

  if (isPublicInvoiceRoute) {
    return <main className="h-screen overflow-auto bg-background">{children}</main>;
  }

  if (isPublicRoute) {
    return (
      <PublicLayout pathname={pathname}>{children}</PublicLayout>
    );
  }

  return (
    <SidebarProvider defaultOpen={false} className="h-dvh overflow-hidden">
      <AppSidebar user={user} ownerOnboardingStatus={ownerOnboardingStatus} />
      <SidebarInset className="h-full min-h-0 overflow-hidden md:m-0 md:rounded-none md:shadow-none">
        <main className="app-shell-main flex h-full min-h-0 flex-1 overflow-hidden p-2 pb-[5.25rem] md:p-4">
          <div className="app-shell-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-surface/90 shadow-[0_20px_60px_hsl(var(--foreground)/0.06)] backdrop-blur">
            <div className="px-2 pt-2 md:hidden">
              <SidebarTrigger className="rounded-lg border border-border/70 bg-card hover:bg-accent" />
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {children}
            </div>
          </div>
        </main>
      </SidebarInset>
      <MobileBottomNav pathname={pathname} isSuperadmin={Boolean(user?.isSuperadmin)} />
    </SidebarProvider>
  );
}
