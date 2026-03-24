"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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

  const isPublicInvoiceRoute = pathname.startsWith("/i/");
  const isPublicRoute = publicRoutes.has(pathname) || isPublicInvoiceRoute;

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
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface/75 px-4 backdrop-blur md:px-6">
          <Link className="text-sm font-semibold tracking-tight text-foreground" href="/">
            20byte
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    );
  }

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
