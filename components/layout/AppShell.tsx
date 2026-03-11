"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, LayoutDashboard, MessageCircle, Settings, Users } from "lucide-react";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type AppShellProps = {
  user: {
    email: string;
    name: string | null;
  } | null;
  children: React.ReactNode;
};

const navItems = [
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings }
];

const publicRoutes = new Set(["/", "/login", "/register"]);

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.has(pathname);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const rawValue = window.localStorage.getItem("app-shell-sidebar-expanded");
    setIsExpanded(rawValue === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("app-shell-sidebar-expanded", isExpanded ? "1" : "0");
  }, [isExpanded]);

  if (isPublicRoute) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface/75 px-4 backdrop-blur md:px-6">
          <Link className="text-sm font-semibold tracking-tight text-foreground" href="/">
            20byte
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu user={user} />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`relative z-20 hidden border-r border-border/80 bg-surface px-2 py-4 transition-[width] duration-200 md:flex md:flex-col ${
          isExpanded ? "w-52" : "w-14"
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-1">
          <Link
            className={`flex h-8 items-center rounded-lg bg-foreground text-xs font-semibold text-background ${
              isExpanded ? "justify-start gap-2 px-2.5" : "w-8 justify-center"
            }`}
            href="/dashboard"
          >
            <span>20</span>
            {isExpanded ? <span className="text-[10px] tracking-wide">20BYTE</span> : null}
          </Link>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="sr-only">{isExpanded ? "Collapse sidebar" : "Expand sidebar"}</span>
          </button>
        </div>
        <nav className={`flex flex-1 flex-col gap-1.5 border-t border-border/80 pt-2 ${isExpanded ? "items-stretch" : "items-center"}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.label}
                href={item.href}
                title={isExpanded ? undefined : item.label}
                className={`flex h-9 items-center rounded-md transition ${
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                } ${isExpanded ? "gap-2 px-2.5" : "w-9 justify-center"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {isExpanded ? (
                  <span className="text-sm font-medium">{item.label}</span>
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={`mt-2 border-t border-border/80 pt-2 ${isExpanded ? "px-0.5" : ""}`}>
          <div className={`flex ${isExpanded ? "justify-start" : "justify-center"}`}>
            <AccountMenu user={user} sidebarExpanded={isExpanded} />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface/75 px-4 backdrop-blur md:hidden">
          <Link className="text-sm font-semibold tracking-tight text-foreground" href="/dashboard">
            20byte
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu user={user} />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
