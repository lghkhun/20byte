"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, LayoutDashboard, MessageCircle, Settings, Shield, Users, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { dismissNotify, notifyLoading } from "@/lib/ui/notify";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  pathname: string;
  isSuperadmin?: boolean;
};

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({ pathname, isSuperadmin = false }: MobileBottomNavProps) {
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const loadingToastIdRef = useRef<string | number | null>(null);
  const navItems = useMemo(
    () =>
      [
        { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { title: "Inbox", href: "/inbox", icon: MessageCircle },
        { title: "Customers", href: "/customers", icon: Users },
        { title: "Invoices", href: "/invoices", icon: FileText },
        { title: "Pipeline", href: "/crm/pipelines", icon: Workflow },
        ...(isSuperadmin ? [{ title: "SA", href: "/sa", icon: Shield }] : []),
        { title: "Settings", href: "/settings", icon: Settings }
      ] as const,
    [isSuperadmin]
  );

  useEffect(() => {
    setPendingPath(null);
    if (loadingToastIdRef.current !== null) {
      dismissNotify(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      return;
    }

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || connection?.effectiveType === "2g") {
      return;
    }

    const prefetch = () => {
      for (const item of navItems) {
        router.prefetch(item.href);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => prefetch(), { timeout: 2000 });
      return () => {
        window.cancelIdleCallback(id);
      };
    }

    const timeout = window.setTimeout(prefetch, 500);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [navItems, router]);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-2 bottom-2 z-50 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-[0_12px_40px_hsl(var(--foreground)/0.14)] backdrop-blur supports-[padding:max(0px)]:pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className={`grid gap-1 ${isSuperadmin ? "grid-cols-8" : "grid-cols-7"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href) || pendingPath === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                aria-label={item.title}
                onMouseEnter={() => router.prefetch(item.href)}
                onFocus={() => router.prefetch(item.href)}
                onClick={() => {
                  if (isActivePath(pathname, item.href)) {
                    return;
                  }
                  setPendingPath(item.href);
                  if (loadingToastIdRef.current !== null) {
                    dismissNotify(loadingToastIdRef.current);
                  }
                  loadingToastIdRef.current = notifyLoading("Sedang memuat halaman...");
                }}
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl border transition",
                  active
                    ? "border-primary/35 bg-primary/12 text-primary shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
