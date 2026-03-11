import test from "node:test";
import assert from "node:assert/strict";

import { captureModalLifecycleState, shouldFocusElement } from "@/lib/a11y/modalLifecycle";

test("captureModalLifecycleState stores body overflow and HTMLElement focus", () => {
  const button = {
    focus() {
      return;
    }
  } as unknown as HTMLElement;

  const state = captureModalLifecycleState(button, "hidden");
  assert.equal(state.previousOverflow, "hidden");
  assert.equal(state.previousFocus, button);
});

test("captureModalLifecycleState ignores non-HTMLElement focus value", () => {
  const state = captureModalLifecycleState(null, "auto");
  assert.equal(state.previousOverflow, "auto");
  assert.equal(state.previousFocus, null);
});

test("shouldFocusElement narrows nullable focus target", () => {
  const button = {
    focus() {
      return;
    }
  } as unknown as HTMLElement;

  assert.equal(shouldFocusElement(button), true);
  assert.equal(shouldFocusElement(null), false);
  assert.equal(shouldFocusElement(undefined), false);
});
