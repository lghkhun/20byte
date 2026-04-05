"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { UserCog } from "lucide-react";

import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SettingsHeaderActionContext } from "@/components/settings/settings-header-actions";

export function ProfileWorkspace() {
  const [headerActions, setHeaderActions] = useState<Record<string, ReactNode>>({});
  const renderedHeaderActions = useMemo(() => Object.entries(headerActions).sort(([left], [right]) => left.localeCompare(right)), [headerActions]);
  const registerHeaderAction = useCallback((key: string, action: ReactNode) => {
    setHeaderActions((current) => {
      if (current[key] === action) {
        return current;
      }

      return { ...current, [key]: action };
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
  const headerActionContextValue = useMemo(
    () => ({
      register: registerHeaderAction,
      unregister: unregisterHeaderAction
    }),
    [registerHeaderAction, unregisterHeaderAction]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card px-3 py-2 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] md:px-6 md:py-5">
        <section aria-label="Profile Settings content" className="inbox-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="sticky top-0 z-10 -mx-1 mb-5 border-b border-border/50 bg-card/95 px-1 pb-4 pt-1 backdrop-blur supports-[backdrop-filter]:bg-card/85">
            <div className="px-2 py-2">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-3 text-primary ring-1 ring-inset ring-primary/20">
                    <UserCog className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold tracking-tight text-foreground md:text-[26px]">Profile Settings</h2>
                    <p className="mt-1.5 max-w-3xl text-[14px] font-medium leading-relaxed text-muted-foreground/80">
                      Perbarui identitas akun, foto avatar, dan keamanan login.
                    </p>
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
            <div className="px-2 pb-4">
              <ProfileSettings />
            </div>
          </SettingsHeaderActionContext.Provider>
        </section>
      </section>
    </div>
  );
}
