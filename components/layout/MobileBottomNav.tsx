"use client";

import Link from "next/link";
import { FileText, LayoutDashboard, MessageCircle, Settings, Users, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  pathname: string;
};

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Inbox", href: "/inbox", icon: MessageCircle },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Invoices", href: "/invoices", icon: FileText },
  { title: "Pipeline", href: "/crm/pipelines", icon: Workflow },
  { title: "Settings", href: "/settings", icon: Settings }
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({ pathname }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-2 bottom-2 z-50 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-[0_12px_40px_hsl(var(--foreground)/0.14)] backdrop-blur supports-[padding:max(0px)]:pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="grid grid-cols-6 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={item.title}
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
