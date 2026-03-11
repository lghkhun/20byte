"use client";

import { CircleDashed, Cog, LogOut, Maximize2, MessageCircleMore, PanelRightClose, Rows3, Trash2, UsersRound } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

type InboxRailProps = {
  workspaceSubtitle: string;
  density: "compact" | "comfy";
  isCrmPanelVisible: boolean;
  onToggleDensity: () => void;
  onToggleCrmPanel: () => void;
  onEnterFocusMode: () => void;
};

export function InboxRail({
  workspaceSubtitle,
  density,
  isCrmPanelVisible,
  onToggleDensity,
  onToggleCrmPanel,
  onEnterFocusMode
}: InboxRailProps) {
  const iconButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:border-border/70 hover:bg-accent hover:text-foreground";

  return (
    <aside className="flex h-[calc(100vh-8rem)] flex-col items-center justify-between rounded-2xl border border-border/80 bg-card/70 py-3 shadow-lg shadow-black/10 backdrop-blur-sm">
      <div className="flex w-full flex-col items-center gap-3">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30"
          title={workspaceSubtitle}
        >
          <MessageCircleMore className="h-5 w-5" />
        </button>
        <button type="button" className={iconButtonClass}>
          <CircleDashed className="h-4 w-4" />
        </button>
        <button type="button" className={iconButtonClass}>
          <UsersRound className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleDensity}
          className={
            density === "compact"
              ? "flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground"
              : iconButtonClass
          }
          title={`Switch to ${density === "comfy" ? "compact" : "comfy"} mode (Ctrl+Shift+D)`}
        >
          <Rows3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleCrmPanel}
          className={
            isCrmPanelVisible
              ? "flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground"
              : iconButtonClass
          }
          title={`${isCrmPanelVisible ? "Hide" : "Show"} CRM panel (Ctrl+Shift+B)`}
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onEnterFocusMode}
          className={iconButtonClass}
          title="Focus chat mode (Ctrl+Shift+F)"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <button type="button" className={iconButtonClass}>
          <Trash2 className="h-4 w-4" />
        </button>
        <ThemeToggle className={iconButtonClass} />
        <button type="button" className={iconButtonClass}>
          <Cog className="h-4 w-4" />
        </button>
        <button type="button" className={`${iconButtonClass} mb-1`}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
