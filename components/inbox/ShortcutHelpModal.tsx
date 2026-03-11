"use client";

import { useRef } from "react";

import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";

type ShortcutHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUTS = [
  { key: "N", action: "Next unassigned conversation" },
  { key: "A", action: "Assign selected conversation to self" },
  { key: "I", action: "Open invoice drawer" },
  { key: "P", action: "Attach payment proof" },
  { key: "/", action: "Open quick reply" },
  { key: "Ctrl+/", action: "Open shortcut help" }
] as const;

export function ShortcutHelpModal({ open, onClose }: ShortcutHelpModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useModalAccessibility({
    open,
    onClose,
    containerRef,
    initialFocusRef: closeButtonRef
  });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div ref={containerRef} className="mx-auto mt-20 w-full max-w-lg rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
          >
            Close
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="rounded border border-border bg-background/60 px-2 py-0.5 text-xs text-foreground">{item.key}</span>
              <span className="text-xs text-muted-foreground">{item.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
