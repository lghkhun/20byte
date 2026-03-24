import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  currentPath,
  title,
  ...props
}: {
  items: ReadonlyArray<{
    title: string;
    url: string;
    icon: LucideIcon;
  }>;
  currentPath?: string;
  title?: string;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const router = useRouter();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPendingPath(null);
  }, [currentPath]);

  return (
    <SidebarGroup {...props}>
      {title ? <SidebarGroupLabel>{title}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={currentPath === item.url || currentPath?.startsWith(`${item.url}/`) || pendingPath === item.url}
              >
                <Link
                  href={item.url}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.url)}
                  onFocus={() => router.prefetch(item.url)}
                  onClick={() => {
                    if (currentPath === item.url || currentPath?.startsWith(`${item.url}/`)) {
                      return;
                    }
                    setPendingPath(item.url);
                  }}
                >
                  <item.icon />
                  <span>{item.title}</span>
                  {pendingPath === item.url ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
