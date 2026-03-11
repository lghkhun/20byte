import { useEffect, useState } from "react";

const INBOX_DENSITY_STORAGE_KEY = "inbox-density";
const INBOX_CRM_PANEL_STORAGE_KEY = "inbox-crm-panel-visible";
const INBOX_FOCUS_MODE_STORAGE_KEY = "inbox-focus-mode";

export function useInboxWorkspacePreferences() {
  const [density, setDensity] = useState<"compact" | "comfy">("comfy");
  const [isCrmPanelVisible, setIsCrmPanelVisible] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const storedDensity = window.localStorage.getItem(INBOX_DENSITY_STORAGE_KEY);
    if (storedDensity === "compact" || storedDensity === "comfy") {
      setDensity(storedDensity);
    }

    const storedCrmPanelVisible = window.localStorage.getItem(INBOX_CRM_PANEL_STORAGE_KEY);
    if (storedCrmPanelVisible === "true" || storedCrmPanelVisible === "false") {
      setIsCrmPanelVisible(storedCrmPanelVisible === "true");
    }

    const storedFocusMode = window.localStorage.getItem(INBOX_FOCUS_MODE_STORAGE_KEY);
    if (storedFocusMode === "true" || storedFocusMode === "false") {
      setIsFocusMode(storedFocusMode === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(INBOX_DENSITY_STORAGE_KEY, density);
  }, [density]);

  useEffect(() => {
    window.localStorage.setItem(INBOX_CRM_PANEL_STORAGE_KEY, String(isCrmPanelVisible));
  }, [isCrmPanelVisible]);

  useEffect(() => {
    window.localStorage.setItem(INBOX_FOCUS_MODE_STORAGE_KEY, String(isFocusMode));
  }, [isFocusMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "d") {
        event.preventDefault();
        setDensity((current) => (current === "comfy" ? "compact" : "comfy"));
      }

      if (key === "b") {
        event.preventDefault();
        setIsCrmPanelVisible((current) => !current);
      }

      if (key === "f") {
        event.preventDefault();
        setIsFocusMode((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    density,
    setDensity,
    isCrmPanelVisible,
    setIsCrmPanelVisible,
    isFocusMode,
    setIsFocusMode
  };
}
