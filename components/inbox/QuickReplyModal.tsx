"use client";

import { useRef } from "react";

import { useModalAccessibility } from "@/lib/a11y/useModalAccessibility";

type QuickReplyModalProps = {
  open: boolean;
  onClose: () => void;
  onPick: (text: string) => Promise<void>;
};

const QUICK_REPLIES = [
  "Hello, thank you for contacting us.",
  "Thank you, we will review and reply shortly.",
  "Can you share your preferred schedule and location?",
  "Please send your transfer proof here for payment confirmation."
] as const;

export function QuickReplyModal({ open, onClose, onPick }: QuickReplyModalProps) {
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
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Quick reply">
      <div ref={containerRef} className="mx-auto mt-24 w-full max-w-xl rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Quick Reply</h2>
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
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => {
                void onPick(reply);
              }}
              className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
