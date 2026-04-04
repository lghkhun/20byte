import test from "node:test";
import assert from "node:assert/strict";

import { isRequestVersionCurrent, issueRequestVersion } from "@/components/inbox/workspace/controller/requestVersionGuard";

test("request version guard marks only latest request as current per key", () => {
  const store = new Map<string, number>();

  const first = issueRequestVersion(store, "conversation:1:latest");
  const second = issueRequestVersion(store, "conversation:1:latest");
  const other = issueRequestVersion(store, "conversation:2:latest");

  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.equal(other, 1);

  assert.equal(isRequestVersionCurrent(store, "conversation:1:latest", first), false);
  assert.equal(isRequestVersionCurrent(store, "conversation:1:latest", second), true);
  assert.equal(isRequestVersionCurrent(store, "conversation:2:latest", other), true);
});

test("request version guard rejects invalid key/version", () => {
  const store = new Map<string, number>();
  issueRequestVersion(store, "conversation:1:latest");

  assert.equal(isRequestVersionCurrent(store, "   ", 1), false);
  assert.equal(isRequestVersionCurrent(store, "conversation:1:latest", Number.NaN), false);
  assert.throws(() => issueRequestVersion(store, "   "));
});
