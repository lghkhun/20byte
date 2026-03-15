"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, LayoutDashboard, MessageCircle, Settings, ShieldCheck, Users, Workflow } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
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
  }
] as const;

const navSecondary = [
  {
    title: "Business",
    url: "/dashboard/settings/business",
    icon: Building2
  },
  {
    title: "WhatsApp",
    url: "/dashboard/settings/whatsapp",
    icon: ShieldCheck
  },
  {
    title: "CRM Pipeline",
    url: "/crm/pipelines",
    icon: Workflow
  },
  {
    title: "General",
    url: "/settings",
    icon: Settings
  }
] as const;

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpen, isMobile } = useSidebar();

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
        if (!isMobile) {
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
        <NavSecondary currentPath={pathname} items={navSecondary} title="Business Tools" className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
