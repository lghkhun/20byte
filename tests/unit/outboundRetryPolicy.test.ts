import test from "node:test";
import assert from "node:assert/strict";
import { MessageType } from "@prisma/client";

import { isRetryableOutboundType } from "@/server/services/message/retryPolicy";

test("retry policy marks text/template/media types as retryable", () => {
  assert.equal(isRetryableOutboundType(MessageType.TEXT), true);
  assert.equal(isRetryableOutboundType(MessageType.TEMPLATE), true);
  assert.equal(isRetryableOutboundType(MessageType.IMAGE), true);
  assert.equal(isRetryableOutboundType(MessageType.VIDEO), true);
  assert.equal(isRetryableOutboundType(MessageType.AUDIO), true);
  assert.equal(isRetryableOutboundType(MessageType.DOCUMENT), true);
});

test("retry policy rejects unsupported outbound types", () => {
  assert.equal(isRetryableOutboundType(MessageType.SYSTEM), false);
});
