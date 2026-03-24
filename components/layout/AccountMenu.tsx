"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, LogOut, Settings, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { invalidateOrganizationsCache } from "@/lib/client/orgsCache";

type AccountMenuProps = {
  user: {
    email: string;
    name: string | null;
  } | null;
  sidebarExpanded?: boolean;
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

export function AccountMenu({ user, sidebarExpanded = false }: AccountMenuProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const initials = useMemo(() => {
    if (!user) {
      return "";
    }

    return toInitials(user.name, user.email);
  }, [user]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 224;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));
    const openUp = rect.top > viewportHeight * 0.6;
    const top = openUp ? Math.max(8, rect.top - 12) : Math.min(viewportHeight - 8, rect.bottom + 12);

    setMenuPosition({ top, left });

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onReposition = () => {
      const latestRect = triggerRef.current?.getBoundingClientRect();
      if (!latestRect) {
        return;
      }

      const nextLeft = Math.max(8, Math.min(latestRect.left, window.innerWidth - menuWidth - 8));
      const nextOpenUp = latestRect.top > window.innerHeight * 0.6;
      const nextTop = nextOpenUp
        ? Math.max(8, latestRect.top - 12)
        : Math.min(window.innerHeight - 8, latestRect.bottom + 12);
      setMenuPosition({ top: nextTop, left: nextLeft });
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  if (!user) {
    if (sidebarExpanded) {
      return (
        <Button asChild size="sm" variant="ghost" className="w-full justify-start">
          <Link href="/login">Login</Link>
        </Button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">Register</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative z-50">
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`cursor-pointer transition ${
          sidebarExpanded
            ? "flex h-10 w-full items-center justify-between rounded-xl border border-border bg-card/90 px-2.5 hover:bg-accent/70"
            : "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-primary/15 text-xs font-semibold text-primary hover:bg-primary/20"
        }`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {sidebarExpanded ? (
          <>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {initials}
            </span>
            <span className="min-w-0 flex-1 px-2 text-left">
              <span className="block truncate text-xs font-medium text-foreground">{user.name ?? "Account"}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            </span>
            <ChevronUp className={`h-4 w-4 text-muted-foreground transition ${open ? "" : "rotate-180"}`} />
          </>
        ) : (
          initials
        )}
      </button>
      {open ? (
          <div
            ref={menuRef}
            className="fixed z-[90] w-56 rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur"
            style={{
              left: menuPosition?.left ?? 8,
              top: menuPosition?.top ?? 8,
              transform: (menuPosition?.top ?? 0) > (triggerRef.current?.getBoundingClientRect().top ?? 0) ? "none" : "translateY(-100%)"
            }}
          >
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">{user.name ?? "No name"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="mt-2 space-y-1">
              <Link
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition hover:bg-accent"
                href="/dashboard/settings/profile"
                onClick={() => setOpen(false)}
              >
                <UserCircle className="h-4 w-4" />
                Profile Settings
              </Link>
              <Link
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition hover:bg-accent"
                href="/dashboard/settings/shortlinks"
                onClick={() => setOpen(false)}
              >
                <Settings className="h-4 w-4" />
                Business Settings
              </Link>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                disabled={isSubmitting}
                onClick={async () => {
                  if (isSubmitting) {
                    return;
                  }

                  setIsSubmitting(true);
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } finally {
                    invalidateOrganizationsCache();
                    setOpen(false);
                    setIsSubmitting(false);
                    router.push("/login");
                    router.refresh();
                  }
                }}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                {isSubmitting ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
      ) : null}
    </div>
  );
}
