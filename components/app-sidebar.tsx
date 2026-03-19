"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Link2, MessageCircle, Users, Workflow } from "lucide-react";
import { useState } from "react";

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
  useSidebar
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  user: {
    email: string;
    name: string | null;
    avatarUrl?: string | null;
  } | null;
};

const navMain = [
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
  }
] as const;

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpen, isMobile } = useSidebar();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      onMouseEnter={() => {
        if (!isMobile) {
          setOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (!isMobile && !isAccountMenuOpen) {
          setOpen(false);
        }
      }}
      onFocusCapture={() => {
        if (!isMobile) {
          setOpen(true);
        }
      }}
      onBlurCapture={(event) => {
        if (!isMobile && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
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
        <NavMain currentPath={pathname} items={navMain.map((item) => ({ ...item, isActive: pathname === item.url || pathname.startsWith(`${item.url}/`) }))} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onMenuOpenChange={setIsAccountMenuOpen} />
      </SidebarFooter>
    </Sidebar>
  );
}
