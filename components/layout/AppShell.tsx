"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { fetchJsonCached } from "@/lib/client/fetchCache";

type AppShellProps = {
  user: {
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    isSuperadmin?: boolean;
    primaryOrgId?: string | null;
    primaryOrgRole?: "OWNER" | "ADMIN" | "CS" | "ADVERTISER" | null;
  } | null;
  children: React.ReactNode;
};

const publicRoutes = new Set(["/", "/login", "/register", "/set-password"]);

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const lastLockStateRef = useRef<{ checkedAt: number; isLocked: boolean } | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const isPublicInvoiceRoute = pathname.startsWith("/i/");
  const isPublicRoute = publicRoutes.has(pathname) || isPublicInvoiceRoute;

  /* ── Scroll-aware header state ── */
  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > 24);
  }, []);

  useEffect(() => {
    if (!isPublicRoute || isPublicInvoiceRoute) return;
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isPublicRoute, isPublicInvoiceRoute, onScroll]);

  /* ── Billing lock guard ── */
  useEffect(() => {
    if (!user || isPublicRoute) return;
    if (user.primaryOrgRole !== "OWNER") return;

    const billingAllowedRoutes = ["/billing", "/settings/profile"];
    if (billingAllowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
      return;
    }

    const now = Date.now();
    const cached = lastLockStateRef.current;
    if (cached && now - cached.checkedAt < 30_000) {
      if (cached.isLocked) router.replace("/billing");
      return;
    }

    let active = true;

    async function checkBillingLock() {
      try {
        const payload = await fetchJsonCached<{ data?: { state?: { isLocked?: boolean } } }>(
          "/api/billing/subscription",
          { ttlMs: 15_000, init: { cache: "no-store" } }
        );
        const isLocked = Boolean(payload?.data?.state?.isLocked);
        lastLockStateRef.current = { checkedAt: Date.now(), isLocked };
        if (active && isLocked) router.replace("/billing");
      } catch {
        // no-op
      }
    }

    void checkBillingLock();
    return () => { active = false; };
  }, [isPublicRoute, pathname, router, user]);

  /* ── Public invoice pages (no shell) ── */
  if (isPublicInvoiceRoute) {
    return <main className="h-screen overflow-auto bg-background">{children}</main>;
  }

  /* ── Public pages (landing, login, register) ── */
  if (isPublicRoute) {
    return (
      <div className="relative min-h-screen">
        <header
          className={`fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between px-5 transition-all duration-500 ease-out md:px-8 ${
            scrolled
              ? "border-b border-border/30 bg-background/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] backdrop-blur-2xl backdrop-saturate-150"
              : "border-b border-transparent bg-transparent"
          }`}
        >
          <Link className="text-sm font-bold tracking-tight text-foreground" href="/">
            20byte
          </Link>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            {pathname !== "/login" && (
              <Link
                href="/login"
                className="inline-flex h-8 items-center justify-center rounded-full px-4 text-xs font-medium text-foreground/80 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground"
              >
                Masuk
              </Link>
            )}
            {pathname !== "/register" && (
              <Link
                href="/register"
                className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[0_1px_4px_hsl(160_84%_39%/0.3)] transition-all duration-200 hover:brightness-110"
              >
                Daftar Gratis
              </Link>
            )}
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  /* ── Authenticated shell ── */
  return (
    <SidebarProvider defaultOpen={true} className="h-dvh overflow-hidden">
      <AppSidebar user={user} />
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
