import test from "node:test";
import assert from "node:assert/strict";

import { buildChatMediaObjectKey, buildInvoicePdfObjectKey } from "@/lib/storage/mediaObjectKey";

test("buildChatMediaObjectKey uses MIME extension as primary source", () => {
  const key = buildChatMediaObjectKey({
    orgId: "org-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    mimeType: "image/jpeg",
    fileName: "fake.pdf"
  });

  assert.equal(key, "media/org-1/conv-1/msg-1.jpg");
});

test("buildChatMediaObjectKey falls back to filename extension then bin", () => {
  const byFileName = buildChatMediaObjectKey({
    orgId: "org-1",
    conversationId: "conv-1",
    messageId: "msg-2",
    fileName: "voice-note.ogg"
  });
  assert.equal(byFileName, "media/org-1/conv-1/msg-2.ogg");

  const fallbackBin = buildChatMediaObjectKey({
    orgId: "org-1",
    conversationId: "conv-1",
    messageId: "msg-3"
  });
  assert.equal(fallbackBin, "media/org-1/conv-1/msg-3.bin");
});

test("buildChatMediaObjectKey normalizes known MIME aliases", () => {
  const key = buildChatMediaObjectKey({
    orgId: "org-1",
    conversationId: "conv-1",
    messageId: "msg-4",
    mimeType: "audio/mp4"
  });

  assert.equal(key, "media/org-1/conv-1/msg-4.m4a");
});

test("buildInvoicePdfObjectKey always uses fixed pdf extension", () => {
  const key = buildInvoicePdfObjectKey({
    orgId: "org-1",
    invoiceId: "inv-1"
  });

  assert.equal(key, "invoice/org-1/inv-1.pdf");
});
