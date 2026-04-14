"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, ChevronsUpDown, LogOut, ReceiptText, Settings, UserCircle, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useLocalImageCache } from "@/lib/client/localImageCache";
import { invalidateOrganizationsCache } from "@/lib/client/orgsCache";
import { dismissNotify, notifyLoading } from "@/lib/ui/notify";

type NavUserProps = {
  user: {
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    primaryOrgRole?: "OWNER" | "ADMIN" | "CS" | "ADVERTISER" | null;
  } | null;
  onMenuOpenChange?: (open: boolean) => void;
};
type ProfileUpdateDetail = {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string;
  avatarVersion?: string;
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

export function NavUser({ user, onMenuOpenChange }: NavUserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [displayName, setDisplayName] = useState(user?.name ?? null);
  const [displayEmail, setDisplayEmail] = useState(user?.email ?? "");
  const [avatarVersion, setAvatarVersion] = useState<string | null>(null);
  const loadingToastIdRef = useRef<string | number | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initials = user ? toInitials(displayName, displayEmail) : "";
  const sidebarEmail = displayEmail;
  const isOwner = user?.primaryOrgRole === "OWNER";
  const cachedAvatarUrl = useLocalImageCache(avatarUrl, {
    cacheKey: `user-avatar:${displayEmail.toLowerCase()}:${avatarVersion ?? "v0"}`,
    ttlMs: 24 * 60 * 60 * 1000,
    maxBytes: 256 * 1024
  });

  function startMenuLoading(message: string) {
    if (loadingToastIdRef.current !== null) {
      dismissNotify(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    loadingToastIdRef.current = notifyLoading(message);
    loadingTimeoutRef.current = setTimeout(() => {
      if (loadingToastIdRef.current !== null) {
        dismissNotify(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    }, 8000);
  }

  useEffect(() => {
    setAvatarUrl(user?.avatarUrl ?? null);
    setDisplayName(user?.name ?? null);
    setDisplayEmail(user?.email ?? "");
    setAvatarVersion(null);
  }, [user?.avatarUrl, user?.email, user?.name]);

  useEffect(() => {
    if (loadingToastIdRef.current !== null) {
      dismissNotify(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ProfileUpdateDetail>).detail;
      if (!detail) {
        return;
      }

      if ("avatarUrl" in detail) {
        setAvatarUrl(detail.avatarUrl ?? null);
      }
      if ("avatarVersion" in detail) {
        setAvatarVersion(detail.avatarVersion ?? null);
      }
      if ("name" in detail) {
        setDisplayName(detail.name ?? null);
      }
      if ("email" in detail && detail.email) {
        setDisplayEmail(detail.email);
      }
    };

    window.addEventListener("app-profile-updated", handleProfileUpdated as EventListener);
    return () => {
      window.removeEventListener("app-profile-updated", handleProfileUpdated as EventListener);
    };
  }, [user]);

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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={cachedAvatarUrl} alt={displayName ?? displayEmail} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-sidebar-primary">{initials}</AvatarFallback>
                </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName ?? "Account"}</span>
                <span className="truncate text-xs">{sidebarEmail}</span>
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
                  <AvatarImage src={cachedAvatarUrl} alt={displayName ?? displayEmail} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-sidebar-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName ?? "Account"}</span>
                  <span className="truncate text-xs">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => {
                  startMenuLoading("Membuka Profile Settings...");
                  router.push("/settings/profile");
                }}
              >
                <BadgeCheck />
                Profile Settings
              </DropdownMenuItem>
              {isOwner ? (
                <DropdownMenuItem
                  onSelect={() => {
                    startMenuLoading("Membuka Business Settings...");
                    router.push("/settings?tab=business");
                  }}
                >
                  <Settings />
                  Business Settings
                </DropdownMenuItem>
              ) : null}
              {isOwner ? (
                <DropdownMenuItem
                  onSelect={() => {
                    startMenuLoading("Membuka Billing...");
                    router.push("/billing");
                  }}
                >
                  <ReceiptText />
                  Billing
                </DropdownMenuItem>
              ) : null}
              {isOwner ? (
                <DropdownMenuItem
                  onSelect={() => {
                    startMenuLoading("Membuka Finance...");
                    router.push("/finance");
                  }}
                >
                  <Wallet />
                  Finance
                </DropdownMenuItem>
              ) : null}
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                <span className="text-foreground">Appearance</span>
                <ThemeToggle className="h-8 w-8 rounded-md border border-border/70" />
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                startMenuLoading("Memproses logout...");
                await fetch("/api/auth/logout", { method: "POST" });
                invalidateOrganizationsCache();
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
