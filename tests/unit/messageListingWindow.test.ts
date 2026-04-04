import test from "node:test";
import assert from "node:assert/strict";

import { buildLatestMessageWindow } from "@/server/services/message/listing";

test("buildLatestMessageWindow keeps latest window and returns oldest id as next cursor", () => {
  const rowsDesc = [
    { id: "msg-5", createdAt: "2026-03-06T10:05:00.000Z" },
    { id: "msg-4", createdAt: "2026-03-06T10:04:00.000Z" },
    { id: "msg-3", createdAt: "2026-03-06T10:03:00.000Z" },
    { id: "msg-2", createdAt: "2026-03-06T10:02:00.000Z" }
  ];

  const result = buildLatestMessageWindow(rowsDesc, 3);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextBeforeMessageId, "msg-3");
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["msg-3", "msg-4", "msg-5"]
  );
});

test("buildLatestMessageWindow disables cursor when all messages fit current window", () => {
  const rowsDesc = [
    { id: "msg-2" },
    { id: "msg-1" }
  ];

  const result = buildLatestMessageWindow(rowsDesc, 30);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextBeforeMessageId, null);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["msg-1", "msg-2"]
  );
});
