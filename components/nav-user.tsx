"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronsUpDown, LogOut, Settings, UserCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavUserProps = {
  user: {
    email: string;
    name: string | null;
  } | null;
};

function toInitials(name: string | null, email: string): string {
  const normalizedName = (name ?? "").trim();
  if (normalizedName) {
    const initials = normalizedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    if (initials) {
      return initials;
    }
  }

  return email.slice(0, 2).toUpperCase();
}

export function NavUser({ user }: NavUserProps) {
  const router = useRouter();
  const { isMobile } = useSidebar();

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="lg">
            <Link href="/login">
              <UserCircle />
              <span>Login</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const initials = toInitials(user.name, user.email);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-sidebar-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name ?? "Account"}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-sidebar-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name ?? "Account"}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/profile">
                  <BadgeCheck />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Business Settings
                </Link>
              </DropdownMenuItem>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                <span className="text-foreground">Appearance</span>
                <ThemeToggle className="h-8 w-8 rounded-md border border-border/70" />
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
