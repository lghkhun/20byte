import test from "node:test";
import assert from "node:assert/strict";

import { FOCUSABLE_SELECTOR, resolveFocusTrapTarget } from "@/lib/a11y/focusTrap";

test("resolveFocusTrapTarget returns null when no focusable element exists", () => {
  assert.equal(resolveFocusTrapTarget({ activeIndex: 0, total: 0, isShift: false }), null);
});

test("resolveFocusTrapTarget wraps from first to last on Shift+Tab", () => {
  assert.equal(resolveFocusTrapTarget({ activeIndex: 0, total: 4, isShift: true }), 3);
  assert.equal(resolveFocusTrapTarget({ activeIndex: 2, total: 4, isShift: true }), null);
});

test("resolveFocusTrapTarget wraps from last to first on Tab", () => {
  assert.equal(resolveFocusTrapTarget({ activeIndex: 3, total: 4, isShift: false }), 0);
  assert.equal(resolveFocusTrapTarget({ activeIndex: 1, total: 4, isShift: false }), null);
});

test("FOCUSABLE_SELECTOR keeps expected focusable coverage", () => {
  assert.equal(
    FOCUSABLE_SELECTOR,
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
  assert.match(FOCUSABLE_SELECTOR, /\[href\]/);
  assert.match(FOCUSABLE_SELECTOR, /input:not\(\[disabled\]\)/);
  assert.match(FOCUSABLE_SELECTOR, /\[tabindex\]:not\(\[tabindex=\"-1\"\]\)/);
});
