"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

type AppShellProps = {
  user: {
    email: string;
    name: string | null;
  } | null;
  children: React.ReactNode;
};

const publicRoutes = new Set(["/", "/login", "/register"]);

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.has(pathname);

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
    <SidebarProvider defaultOpen={false}>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-0 overflow-hidden md:m-0 md:rounded-none md:shadow-none">
        <main className="flex h-full min-h-0 flex-1 overflow-hidden p-2 md:p-4">
          <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-surface/90 shadow-[0_20px_60px_hsl(var(--foreground)/0.06)] backdrop-blur">
            <div className="px-2 pt-2 md:hidden">
              <SidebarTrigger className="rounded-lg border border-border/70 bg-card hover:bg-accent" />
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {children}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
