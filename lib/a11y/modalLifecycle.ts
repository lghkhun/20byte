export type FocusableElement = {
  focus: () => void;
};

export type ModalLifecycleState = {
  previousOverflow: string;
  previousFocus: FocusableElement | null;
};

export function captureModalLifecycleState(activeElement: Element | null, bodyOverflow: string): ModalLifecycleState {
  return {
    previousOverflow: bodyOverflow,
    previousFocus: shouldFocusElement(activeElement) ? activeElement : null
  };
}

export function shouldFocusElement(element: unknown): element is FocusableElement {
  return typeof element === "object" && element !== null && "focus" in element && typeof element.focus === "function";
}
