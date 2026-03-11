import test from "node:test";
import assert from "node:assert/strict";

import { resolveModalKeydown } from "@/lib/a11y/modalKeydown";

test("resolveModalKeydown returns close for Escape", () => {
  assert.deepEqual(resolveModalKeydown({ key: "Escape", isShift: false, activeIndex: 0, total: 3 }), {
    action: "close"
  });
});

test("resolveModalKeydown returns none for unsupported keys", () => {
  assert.deepEqual(resolveModalKeydown({ key: "Enter", isShift: false, activeIndex: 0, total: 3 }), {
    action: "none"
  });
});

test("resolveModalKeydown resolves focus wrap for Tab and Shift+Tab", () => {
  assert.deepEqual(resolveModalKeydown({ key: "Tab", isShift: false, activeIndex: 2, total: 3 }), {
    action: "focus",
    targetIndex: 0
  });

  assert.deepEqual(resolveModalKeydown({ key: "Tab", isShift: true, activeIndex: 0, total: 3 }), {
    action: "focus",
    targetIndex: 2
  });

  assert.deepEqual(resolveModalKeydown({ key: "Tab", isShift: false, activeIndex: 1, total: 3 }), {
    action: "none"
  });
});
