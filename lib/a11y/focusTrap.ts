export type FocusTrapParams = {
  activeIndex: number;
  total: number;
  isShift: boolean;
};

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function resolveFocusTrapTarget(params: FocusTrapParams): number | null {
  const { activeIndex, total, isShift } = params;
  if (total <= 0) {
    return null;
  }

  if (isShift) {
    return activeIndex === 0 ? total - 1 : null;
  }

  return activeIndex === total - 1 ? 0 : null;
}

export function getFocusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    if ((element as HTMLInputElement).type === "hidden") {
      return false;
    }

    if (element.tabIndex < 0) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}
