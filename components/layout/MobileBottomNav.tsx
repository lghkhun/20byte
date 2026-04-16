"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  MessageCircle,
  Users,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { dismissNotify, notifyLoading } from "@/lib/ui/notify";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  pathname: string;
  isSuperadmin?: boolean;
};

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Inbox", href: "/inbox", icon: MessageCircle, isFab: true },
  { title: "Invoice", href: "/invoices", icon: FileText },
  { title: "Pipeline", href: "/crm/pipelines", icon: Workflow },
] as const;

export function MobileBottomNav({ pathname }: MobileBottomNavProps) {
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const loadingToastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    setPendingPath(null);
    if (loadingToastIdRef.current !== null) {
      dismissNotify(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
  }, [pathname]);

  // Prefetch all nav items on idle
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) return;

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || connection?.effectiveType === "2g") return;

    const prefetch = () => {
      for (const item of NAV_ITEMS) {
        router.prefetch(item.href);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => prefetch(), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }

    const timeout = window.setTimeout(prefetch, 500);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        "border-t border-border/60",
        // Light mode
        "bg-background/95 backdrop-blur-xl",
        // Dark mode
        "dark:bg-zinc-900/95 dark:border-border/40",
        // Safe-area
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-4px_24px_hsl(var(--foreground)/0.06)]",
        "dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
      )}
    >
      <ul className="grid h-16 grid-cols-5 items-end px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            isActivePath(pathname, item.href) || pendingPath === item.href;
          const isFab = "isFab" in item && item.isFab;

          if (isFab) {
            return (
              <li key={item.href} className="flex items-center justify-center pb-2">
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-label={item.title}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  onClick={() => {
                    if (isActivePath(pathname, item.href)) return;
                    setPendingPath(item.href);
                    if (loadingToastIdRef.current !== null) {
                      dismissNotify(loadingToastIdRef.current);
                    }
                    loadingToastIdRef.current = notifyLoading(
                      "Sedang memuat halaman..."
                    );
                  }}
                  className={cn(
                    // FAB base
                    "relative flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full",
                    "shadow-lg transition-all duration-200 active:scale-95",
                    active
                      ? [
                          // Active FAB — solid emerald
                          "bg-emerald-600 text-white",
                          "shadow-emerald-500/40 shadow-xl",
                          "ring-4 ring-emerald-500/20",
                        ]
                      : [
                          // Inactive FAB — lighter emerald
                          "bg-emerald-500 text-white",
                          "shadow-emerald-500/30",
                          "hover:bg-emerald-400 hover:shadow-emerald-400/40",
                        ]
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.2} />
                  {/* Active glow ring animation */}
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-white/10" />
                  )}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex items-stretch">
              <Link
                href={item.href}
                prefetch={false}
                aria-label={item.title}
                onMouseEnter={() => router.prefetch(item.href)}
                onFocus={() => router.prefetch(item.href)}
                onClick={() => {
                  if (isActivePath(pathname, item.href)) return;
                  setPendingPath(item.href);
                  if (loadingToastIdRef.current !== null) {
                    dismissNotify(loadingToastIdRef.current);
                  }
                  loadingToastIdRef.current = notifyLoading(
                    "Sedang memuat halaman..."
                  );
                }}
                className={cn(
                  "group flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2",
                  "text-[10px] font-semibold tracking-wide transition-all duration-150",
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground/70 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-150",
                    active
                      ? "bg-emerald-500/12 dark:bg-emerald-500/15 scale-110"
                      : "group-hover:bg-foreground/6 dark:group-hover:bg-white/6"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-all duration-150",
                      active ? "h-5 w-5" : "h-[18px] w-[18px]"
                    )}
                    strokeWidth={active ? 2.3 : 1.8}
                  />
                </span>
                <span
                  className={cn(
                    "leading-none transition-all duration-150",
                    active ? "opacity-100" : "opacity-70"
                  )}
                >
                  {item.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
