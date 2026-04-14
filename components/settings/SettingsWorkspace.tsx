"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, CreditCard, MessageSquareShare, ShieldCheck, Users2 } from "lucide-react";

import { BusinessSettings } from "@/components/settings/BusinessSettings";
import { InvoicePaymentMethodSettings } from "@/components/settings/InvoicePaymentMethodSettings";
import { MetaCapiManager } from "@/components/settings/MetaCapiManager";
import { ShortlinkManager } from "@/components/settings/ShortlinkManager";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { WhatsAppConnectionSettings } from "@/components/settings/WhatsAppConnectionSettings";
import { SettingsHeaderActionContext } from "@/components/settings/settings-header-actions";
import { dismissNotify, notifyLoading } from "@/lib/ui/notify";

const SETTINGS_TAB_VALUES = ["business", "payment", "team", "whatsapp", "shortlinks"] as const;
type SettingsTabValue = (typeof SETTINGS_TAB_VALUES)[number];

function isSettingsTabValue(value: string): value is SettingsTabValue {
  return SETTINGS_TAB_VALUES.includes(value as SettingsTabValue);
}

function normalizeInitialTab(value: string): SettingsTabValue {
  return isSettingsTabValue(value) ? value : "business";
}

const SETTINGS_TABS: Array<{ id: SettingsTabValue; label: string }> = [
  { id: "business", label: "Business" },
  { id: "payment", label: "Payment" },
  { id: "team", label: "Team" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "shortlinks", label: "Shortlinks + Meta CAPI" }
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
    description: "Kelola identitas bisnis dan default informasi perusahaan.",
    badge: "Core"
  },
  payment: {
    icon: CreditCard,
    title: "Payment Methods",
    description: "Kelola metode pembayaran invoice, biaya gateway, dan rekening bank transfer bisnis.",
    badge: "Billing"
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
    title: "Shortlinks & Meta CAPI",
    description: "Kelola shortlink kampanye, dataset CAPI, dan sinkronisasi event conversion.",
    badge: "Attribution"
  }
};

export function SettingsWorkspace({
  initialTab,
  canAccessBusinessSettings
}: {
  initialTab: string;
  canAccessBusinessSettings: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeInitialTab =
    !canAccessBusinessSettings && (normalizeInitialTab(initialTab) === "business" || normalizeInitialTab(initialTab) === "payment")
      ? "team"
      : normalizeInitialTab(initialTab);
  const [activeTab, setActiveTab] = useState<SettingsTabValue>(safeInitialTab);
  const [headerActions, setHeaderActions] = useState<Record<string, ReactNode>>({});
  const tabLoadingToastIdRef = useRef<string | number | null>(null);

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

  useEffect(() => {
    if (tabLoadingToastIdRef.current !== null) {
      dismissNotify(tabLoadingToastIdRef.current);
      tabLoadingToastIdRef.current = null;
    }
  }, [activeTab]);

  const headerActionContextValue = useMemo(
    () => ({
      register: registerHeaderAction,
      unregister: unregisterHeaderAction
    }),
    [registerHeaderAction, unregisterHeaderAction]
  );

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab");
    if (!canAccessBusinessSettings && (tabFromQuery === "business" || tabFromQuery === "payment")) {
      setActiveTab("team");
      return;
    }
    if (tabFromQuery && isSettingsTabValue(tabFromQuery) && tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
    }
  }, [activeTab, canAccessBusinessSettings, searchParams]);

  function handleTabChange(nextTab: SettingsTabValue) {
    if (!canAccessBusinessSettings && (nextTab === "business" || nextTab === "payment")) {
      return;
    }
    if (nextTab === activeTab) {
      return;
    }
    if (tabLoadingToastIdRef.current !== null) {
      dismissNotify(tabLoadingToastIdRef.current);
    }
    tabLoadingToastIdRef.current = notifyLoading("Sedang memuat tab...");
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    const nextUrl = `${pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <section className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-card p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] xl:rounded-r-none xl:border-r-0">
          <div className="mb-3 shrink-0 px-2 pt-1">
            <p className="text-sm font-semibold text-foreground">Workspace Menu</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Pilih area pengaturan yang ingin Anda kelola.</p>
          </div>
          <nav className="inbox-scroll flex gap-2 overflow-x-auto pb-1 xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden" aria-label="Settings navigation">
            {SETTINGS_TABS.filter((tab) => canAccessBusinessSettings || (tab.id !== "business" && tab.id !== "payment")).map((tab) => {
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
                      ? "flex min-w-[180px] items-start gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent px-4 py-4 text-left shadow-sm xl:min-w-0"
                      : "group flex min-w-[180px] items-start gap-4 rounded-2xl border border-transparent px-4 py-4 text-left transition-colors hover:bg-muted/40 xl:min-w-0"
                  }
                >
                  <div className={isActive ? "mt-0.5 rounded-xl bg-primary/20 p-2 text-primary ring-1 ring-primary/20" : "mt-0.5 rounded-xl bg-muted p-2 text-muted-foreground group-hover:bg-muted/80"}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={isActive ? "text-[14px] font-bold text-primary" : "text-[14px] font-semibold text-foreground group-hover:text-primary"}>{tab.label}</p>
                    <p className={isActive ? "mt-1.5 text-[12px] font-medium leading-relaxed text-primary/80" : "mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground/70"}>
                      {meta.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card to-background/50 px-3 py-2 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] md:px-6 md:py-5 xl:rounded-l-none">
          <section aria-label={`${activeMeta.title} content`} className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="sticky top-0 z-10 -mx-1 mb-5 border-b border-border/50 bg-card/95 px-1 pb-4 pt-1 backdrop-blur supports-[backdrop-filter]:bg-card/85">
              <div className="px-2 py-2">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-3 text-primary ring-1 ring-inset ring-primary/20">
                      <ActiveIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-[22px] font-bold tracking-tight text-foreground md:text-[26px]">{activeMeta.title}</h2>
                      <p className="mt-1.5 max-w-3xl text-[14px] font-medium leading-relaxed text-muted-foreground/80">{activeMeta.description}</p>
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
                </div>
              ) : null}
              {activeTab === "payment" ? (
                <div className="space-y-8 px-2 pb-4">
                  <InvoicePaymentMethodSettings />
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
                <div className="space-y-6 px-2 pb-4">
                  <MetaCapiManager />
                  <ShortlinkManager />
                </div>
              ) : null}
            </SettingsHeaderActionContext.Provider>
          </section>
        </div>
      </section>
    </div>
  );
}
