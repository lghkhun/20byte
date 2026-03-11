import test from "node:test";
import assert from "node:assert/strict";
import { MessageType } from "@prisma/client";

import { processInboundMessagesWithDeps } from "@/server/services/whatsappWebhookService";

test("processInboundMessagesWithDeps marks lock-miss as duplicate and skips store", async () => {
  const inbound = [
    {
      orgId: "org-1",
      waMessageId: "wamid-dup-lock",
      customerPhoneE164: "+628123456789",
      type: MessageType.TEXT,
      text: "hello"
    }
  ];

  let storeCalls = 0;
  const result = await processInboundMessagesWithDeps(inbound, {
    acquireLock: async () => false,
    storeInbound: async () => {
      storeCalls += 1;
      return {
        stored: false,
        duplicate: false,
        messageId: null,
        conversationId: null,
        conversationStatus: null,
        assignedToMemberId: null
      };
    },
    enqueueMediaDownload: async () => {}
  });

  assert.equal(storeCalls, 0);
  assert.equal(result.acceptedMessageCount, 0);
  assert.equal(result.duplicateMessageCount, 1);
  assert.deepEqual(result.duplicateMessageIds, ["wamid-dup-lock"]);
});

test("processInboundMessagesWithDeps enqueues media once for accepted and duplicate-in-db outcomes", async () => {
  const inbound = [
    {
      orgId: "org-1",
      waMessageId: "wamid-media-accepted",
      customerPhoneE164: "+628111111111",
      type: MessageType.IMAGE,
      mediaId: "media-1"
    },
    {
      orgId: "org-1",
      waMessageId: "wamid-media-duplicate-db",
      customerPhoneE164: "+628222222222",
      type: MessageType.IMAGE,
      mediaId: "media-2"
    }
  ];

  const enqueued: string[] = [];
  const result = await processInboundMessagesWithDeps(inbound, {
    acquireLock: async () => true,
    storeInbound: async (message) => {
      if (message.waMessageId === "wamid-media-accepted") {
        return {
          stored: true,
          duplicate: false,
          messageId: "msg-accepted",
          conversationId: "conv-1",
          conversationStatus: "OPEN",
          assignedToMemberId: null
        };
      }

      return {
        stored: false,
        duplicate: true,
        messageId: "msg-duplicate",
        conversationId: null,
        conversationStatus: null,
        assignedToMemberId: null
      };
    },
    enqueueMediaDownload: async (messageId) => {
      enqueued.push(messageId);
    }
  });

  assert.equal(result.acceptedMessageCount, 1);
  assert.equal(result.duplicateMessageCount, 1);
  assert.deepEqual(result.acceptedMessageIds, ["wamid-media-accepted"]);
  assert.deepEqual(result.duplicateMessageIds, ["wamid-media-duplicate-db"]);
  assert.deepEqual(enqueued, ["msg-accepted", "msg-duplicate"]);
});
