import test from "node:test";
import assert from "node:assert/strict";

import { resolveNextDeliveryState } from "@/server/services/message/statusTransitions";

test("delivery status transitions follow SENT -> DELIVERED -> READ progression", () => {
  const sentAt = new Date("2026-03-06T10:00:00.000Z");
  const deliveredAt = new Date("2026-03-06T10:01:00.000Z");
  const readAt = new Date("2026-03-06T10:02:00.000Z");

  const fromPendingToSent = resolveNextDeliveryState({
    currentStatus: null,
    currentDeliveredAt: null,
    currentReadAt: null,
    incomingStatus: "SENT",
    at: sentAt
  });
  assert.equal(fromPendingToSent.deliveryStatus, "SENT");
  assert.equal(fromPendingToSent.deliveredAt, null);
  assert.equal(fromPendingToSent.readAt, null);
  assert.equal(fromPendingToSent.shouldPersist, true);

  const fromSentToDelivered = resolveNextDeliveryState({
    currentStatus: "SENT",
    currentDeliveredAt: null,
    currentReadAt: null,
    incomingStatus: "DELIVERED",
    at: deliveredAt
  });
  assert.equal(fromSentToDelivered.deliveryStatus, "DELIVERED");
  assert.equal(fromSentToDelivered.deliveredAt?.toISOString(), deliveredAt.toISOString());
  assert.equal(fromSentToDelivered.readAt, null);
  assert.equal(fromSentToDelivered.shouldPersist, true);

  const fromDeliveredToRead = resolveNextDeliveryState({
    currentStatus: "DELIVERED",
    currentDeliveredAt: deliveredAt,
    currentReadAt: null,
    incomingStatus: "READ",
    at: readAt
  });
  assert.equal(fromDeliveredToRead.deliveryStatus, "READ");
  assert.equal(fromDeliveredToRead.deliveredAt?.toISOString(), deliveredAt.toISOString());
  assert.equal(fromDeliveredToRead.readAt?.toISOString(), readAt.toISOString());
  assert.equal(fromDeliveredToRead.shouldPersist, true);
});

test("delivery status transition ignores downgrade updates", () => {
  const deliveredAt = new Date("2026-03-06T10:01:00.000Z");
  const readAt = new Date("2026-03-06T10:02:00.000Z");

  const result = resolveNextDeliveryState({
    currentStatus: "READ",
    currentDeliveredAt: deliveredAt,
    currentReadAt: readAt,
    incomingStatus: "DELIVERED",
    at: new Date("2026-03-06T10:03:00.000Z")
  });

  assert.equal(result.deliveryStatus, "READ");
  assert.equal(result.deliveredAt?.toISOString(), deliveredAt.toISOString());
  assert.equal(result.readAt?.toISOString(), readAt.toISOString());
  assert.equal(result.shouldPersist, false);
});
