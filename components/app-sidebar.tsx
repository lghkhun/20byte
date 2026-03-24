"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { FileText, LayoutDashboard, Link2, MessageCircle, Shield, Users, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
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
import { fetchJsonCached } from "@/lib/client/fetchCache";
import { dismissNotify, notifyLoading } from "@/lib/ui/notify";

type AppSidebarProps = {
  user: {
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    isSuperadmin?: boolean;
    primaryOrgId?: string | null;
    primaryOrgRole?: "OWNER" | "ADMIN" | "CS" | "ADVERTISER" | null;
  } | null;
};

type BillingReminderPayload = {
  data?: {
    reminder?: {
      shouldShowBanner?: boolean;
      message?: string;
    };
  };
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [billingReminderMessage, setBillingReminderMessage] = useState<string | null>(null);
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
        {billingReminderMessage ? (
          <div className="mx-2 mb-2 rounded-xl border border-amber-300/80 bg-amber-100/80 px-2.5 py-2 text-xs leading-5 text-amber-900">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Peringatan Langganan
            </p>
            <p className="mt-1">{billingReminderMessage}</p>
          </div>
        ) : null}
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail side="left" />
    </Sidebar>
  );
}
