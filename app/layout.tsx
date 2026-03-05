import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { FileText, LayoutDashboard, MessageCircle, Settings, Users } from "lucide-react";

import "@/styles/globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

const navItems = [
  { href: "/", label: "Inbox", icon: MessageCircle },
  { href: "/", label: "Customers", icon: Users },
  { href: "/", label: "Invoices", icon: FileText },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Settings", icon: Settings }
];

export const metadata: Metadata = {
  title: "20byte",
  description: "20byte SaaS foundation shell"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen antialiased")}>
        <div className="flex min-h-screen">
          <aside className="hidden w-16 border-r border-border bg-surface md:flex md:flex-col md:items-center md:gap-2 md:py-4">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
              20
            </div>
            <nav className="flex flex-1 flex-col items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-h-screen flex-1 flex-col">
            <header className="flex h-14 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur md:px-6">
              <p className="text-sm font-medium">20byte Workspace</p>
              <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                Foundation Shell
              </span>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
