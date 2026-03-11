import { resolveFocusTrapTarget } from "@/lib/a11y/focusTrap";

export type ModalKeydownInput = {
  key: string;
  isShift: boolean;
  activeIndex: number;
  total: number;
};

export type ModalKeydownDecision =
  | { action: "none" }
  | { action: "close" }
  | { action: "focus"; targetIndex: number };

export function resolveModalKeydown(input: ModalKeydownInput): ModalKeydownDecision {
  if (input.key === "Escape") {
    return { action: "close" };
  }

  if (input.key !== "Tab") {
    return { action: "none" };
  }

  const targetIndex = resolveFocusTrapTarget({
    activeIndex: input.activeIndex,
    total: input.total,
    isShift: input.isShift
  });

  if (targetIndex === null) {
    return { action: "none" };
  }

  return { action: "focus", targetIndex };
}
