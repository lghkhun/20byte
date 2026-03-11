"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { getFocusableElements } from "@/lib/a11y/focusTrap";
import { resolveModalKeydown } from "@/lib/a11y/modalKeydown";
import type { FocusableElement } from "@/lib/a11y/modalLifecycle";
import { captureModalLifecycleState, shouldFocusElement } from "@/lib/a11y/modalLifecycle";

type UseModalAccessibilityInput = {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function useModalAccessibility(input: UseModalAccessibilityInput): void {
  const { open, onClose, containerRef, initialFocusRef } = input;
  const previousFocusRef = useRef<FocusableElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const lifecycleState = captureModalLifecycleState(document.activeElement, document.body.style.overflow);
    previousFocusRef.current = lifecycleState.previousFocus;
    document.body.style.overflow = "hidden";

    if (shouldFocusElement(initialFocusRef?.current)) {
      initialFocusRef.current.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) {
        return;
      }

      const focusable = getFocusableElements(root);
      const active = document.activeElement as HTMLElement | null;
      const activeIndex = focusable.findIndex((element) => element === active);
      const decision = resolveModalKeydown({
        key: event.key,
        isShift: event.shiftKey,
        activeIndex,
        total: focusable.length
      });

      if (decision.action === "close") {
        event.preventDefault();
        onClose();
        return;
      }

      if (decision.action === "focus") {
        event.preventDefault();
        focusable[decision.targetIndex]?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = lifecycleState.previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [containerRef, initialFocusRef, onClose, open]);
}
