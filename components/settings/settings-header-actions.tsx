"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";

type SettingsHeaderActionContextValue = {
  register: (key: string, action: ReactNode) => void;
  unregister: (key: string) => void;
};

export const SettingsHeaderActionContext = createContext<SettingsHeaderActionContextValue | null>(null);

export function useSettingsHeaderAction(key: string, action: ReactNode) {
  const context = useContext(SettingsHeaderActionContext);

  useEffect(() => {
    if (!context) {
      return;
    }

    context.register(key, action);
    return () => {
      context.unregister(key);
    };
  }, [action, context, key]);
}
