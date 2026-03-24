"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
  currentPath,
  pendingPath,
  onNavigateStart
}: {
  items: ReadonlyArray<{
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: ReadonlyArray<{
      title: string;
      url: string;
    }>;
  }>;
  currentPath?: string;
  pendingPath?: string | null;
  onNavigateStart?: (url: string) => void;
}) {
  const router = useRouter();

  function toPathname(url: string): string {
    return url.split("?")[0] ?? url;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={item.isActive || pendingPath === item.url}
              >
                <Link
                  href={item.url}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.url)}
                  onFocus={() => router.prefetch(item.url)}
                  onClick={() => {
                    if (toPathname(currentPath ?? "") === toPathname(item.url)) {
                      return;
                    }
                    onNavigateStart?.(item.url);
                  }}
                >
                  <item.icon />
                  <span>{item.title}</span>
                  {pendingPath === item.url ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : null}
                </Link>
              </SidebarMenuButton>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={currentPath === toPathname(subItem.url) || pendingPath === subItem.url}>
                            <Link
                              href={subItem.url}
                              prefetch={false}
                              onMouseEnter={() => router.prefetch(subItem.url)}
                              onFocus={() => router.prefetch(subItem.url)}
                              onClick={() => {
                                if (toPathname(currentPath ?? "") === toPathname(subItem.url)) {
                                  return;
                                }
                                onNavigateStart?.(subItem.url);
                              }}
                            >
                              <span>{subItem.title}</span>
                              {pendingPath === subItem.url ? <Loader2 className="ml-auto h-3 w-3 animate-spin" /> : null}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
