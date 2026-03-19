"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, MessageSquareShare, ShieldCheck, Users2 } from "lucide-react";

import { BankAccountManager } from "@/components/settings/BankAccountManager";
import { BusinessSettings } from "@/components/settings/BusinessSettings";
import { MetaCapiManager } from "@/components/settings/MetaCapiManager";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { WhatsAppConnectionSettings } from "@/components/settings/WhatsAppConnectionSettings";
import { SettingsHeaderActionContext } from "@/components/settings/settings-header-actions";

const SETTINGS_TAB_VALUES = ["business", "team", "whatsapp", "shortlinks"] as const;
type SettingsTabValue = (typeof SETTINGS_TAB_VALUES)[number];

function isSettingsTabValue(value: string): value is SettingsTabValue {
  return SETTINGS_TAB_VALUES.includes(value as SettingsTabValue);
}

function normalizeInitialTab(value: string): SettingsTabValue {
  return isSettingsTabValue(value) ? value : "business";
}

const SETTINGS_TABS: Array<{ id: SettingsTabValue; label: string }> = [
  { id: "business", label: "Business" },
  { id: "team", label: "Team" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "shortlinks", label: "Meta Pixel + CAPI" }
];

const SETTINGS_TAB_META: Record<
  SettingsTabValue,
  {
    icon: typeof Building2;
    title: string;
    description: string;
    badge: string;
  }
> = {
  business: {
    icon: Building2,
    title: "Business Settings",
    description: "Kelola identitas bisnis, invoice defaults, dan rekening operasional dalam satu tempat.",
    badge: "Core"
  },
  team: {
    icon: Users2,
    title: "Team Settings",
    description: "Atur member bisnis, peran operasional, dan akses kolaborasi tim.",
    badge: "Access"
  },
  whatsapp: {
    icon: MessageSquareShare,
    title: "WhatsApp Settings",
    description: "Pantau koneksi perangkat, QR login, health status, dan sinkronisasi channel.",
    badge: "Channel"
  },
  shortlinks: {
    icon: ShieldCheck,
    title: "Meta Pixel & CAPI",
    description: "Kelola Pixel ID dan Conversions API token untuk kebutuhan tracking dan event conversion.",
    badge: "Attribution"
  }
};

export function SettingsWorkspace({ initialTab }: { initialTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTabValue>(normalizeInitialTab(initialTab));
  const [headerActions, setHeaderActions] = useState<Record<string, ReactNode>>({});

  const activeMeta = useMemo(() => SETTINGS_TAB_META[activeTab], [activeTab]);
  const ActiveIcon = activeMeta.icon;
  const renderedHeaderActions = useMemo(() => Object.entries(headerActions).sort(([left], [right]) => left.localeCompare(right)), [headerActions]);

  const registerHeaderAction = useCallback((key: string, action: ReactNode) => {
    setHeaderActions((current) => {
      if (current[key] === action) {
        return current;
      }

      return {
        ...current,
        [key]: action
      };
    });
  }, []);

  const unregisterHeaderAction = useCallback((key: string) => {
    setHeaderActions((current) => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    setHeaderActions({});
  }, [activeTab]);

  const headerActionContextValue = useMemo(
    () => ({
      register: registerHeaderAction,
      unregister: unregisterHeaderAction
    }),
    [registerHeaderAction, unregisterHeaderAction]
  );

  function handleTabChange(nextTab: SettingsTabValue) {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <section className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-[28px] border border-border/70 bg-card/95 p-3 shadow-sm">
          <div className="mb-3 shrink-0 px-2 pt-1">
            <p className="text-sm font-semibold text-foreground">Workspace Menu</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Pilih area pengaturan yang ingin Anda kelola.</p>
          </div>
          <nav className="inbox-scroll flex gap-2 overflow-x-auto pb-1 xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden" aria-label="Settings navigation">
            {SETTINGS_TABS.map((tab) => {
              const meta = SETTINGS_TAB_META[tab.id];
              const Icon = meta.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={
                    isActive
                      ? "flex min-w-[180px] items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-left text-primary shadow-sm xl:min-w-0"
                      : "flex min-w-[180px] items-start gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-left text-foreground transition hover:bg-accent xl:min-w-0"
                  }
                >
                  <div className={isActive ? "mt-0.5 rounded-xl bg-primary/15 p-2" : "mt-0.5 rounded-xl bg-muted/70 p-2 text-muted-foreground"}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{tab.label}</p>
                    <p className={isActive ? "mt-1 text-xs leading-5 text-primary/80" : "mt-1 text-xs leading-5 text-muted-foreground"}>
                      {meta.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/95 px-3 py-2 shadow-sm md:px-4 md:py-3">
          <section aria-label={`${activeMeta.title} content`} className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="sticky top-0 z-10 -mx-1 mb-5 border-b border-border/70 bg-card/95 px-1 pb-3 pt-1 backdrop-blur supports-[backdrop-filter]:bg-card/85">
              <div className="px-2 py-2">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                      <ActiveIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground md:text-xl">{activeMeta.title}</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{activeMeta.description}</p>
                    </div>
                  </div>
                  {renderedHeaderActions.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      {renderedHeaderActions.map(([key, action]) => (
                        <div key={key}>{action}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <SettingsHeaderActionContext.Provider value={headerActionContextValue}>
              {activeTab === "business" ? (
                <div className="space-y-8 px-2 pb-4">
                  <BusinessSettings />
                  <BankAccountManager />
                </div>
              ) : null}
              {activeTab === "team" ? (
                <div className="px-2 pb-4">
                  <TeamSettings />
                </div>
              ) : null}
              {activeTab === "whatsapp" ? (
                <div className="px-2 pb-4">
                  <WhatsAppConnectionSettings />
                </div>
              ) : null}
              {activeTab === "shortlinks" ? (
                <div className="px-2 pb-4">
                  <MetaCapiManager />
                </div>
              ) : null}
            </SettingsHeaderActionContext.Provider>
          </section>
        </div>
      </section>
    </div>
  );
}
