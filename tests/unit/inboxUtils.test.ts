import assert from "node:assert/strict";
import test from "node:test";

import { formatTime, renderMediaLabel } from "@/components/inbox/bubble/utils";
import { formatDayLabel, toDayKey, toAvatarTone as toChatAvatarTone } from "@/components/inbox/chat/chatUtils";
import { formatTimestamp, getSourceBadge, toAvatarTone as toConversationAvatarTone, toInitials } from "@/components/inbox/conversation-list/utils";
import { formatFileSize, isAllowedAttachmentType, TEMPLATE_COST } from "@/components/inbox/input/utils";
import type { MessageItem } from "@/components/inbox/types";

function mockMessage(type: MessageItem["type"], fileName: string | null = null): MessageItem {
  return {
    id: "m1",
    waMessageId: null,
    direction: "INBOUND",
    type,
    text: null,
    mediaUrl: null,
    mimeType: null,
    fileName,
    templateName: null,
    templateCategory: null,
    templateLanguageCode: null,
    isAutomated: false,
    sendStatus: null,
    deliveryStatus: null,
    sendError: null,
    retryable: false,
    sendAttemptCount: 0,
    deliveredAt: null,
    readAt: null,
    createdAt: "2026-03-06T10:00:00.000Z"
  };
}

test("chat utils produce stable avatar tone and day key behavior", () => {
  assert.equal(toChatAvatarTone("alice"), toChatAvatarTone("alice"));
  assert.notEqual(toChatAvatarTone("alice"), toChatAvatarTone("bob"));

  assert.equal(toDayKey("invalid"), "unknown");
  assert.equal(toDayKey("2026-03-06T00:00:00.000Z"), "2026-03-06");

  assert.equal(formatDayLabel("unknown"), "Tanggal tidak diketahui");
  assert.match(formatDayLabel("2026-99-99"), /\d{2}.*\d{4}/);
});

test("conversation list utils handle initials, source badge, timestamp fallback", () => {
  assert.equal(toInitials("John Doe", "+628111"), "JD");
  assert.equal(toInitials("", "+62 811 22"), "22");
  assert.equal(toInitials(null, "no-digits"), "NA");

  const metaBadge = getSourceBadge("meta_ads");
  assert.equal(metaBadge.label, "META");
  assert.match(metaBadge.className, /sky/);

  const organicBadge = getSourceBadge("organic");
  assert.equal(organicBadge.label, "ORGANIC");

  assert.equal(formatTimestamp(null), "-");
  assert.equal(formatTimestamp("invalid"), "-");
  assert.equal(formatTimestamp("2026-03-05T10:00:00.000Z", new Date("2026-03-06T10:00:00.000Z").getTime()), "Kemarin");

  assert.equal(toConversationAvatarTone("seed"), toConversationAvatarTone("seed"));
});

test("input utils enforce file type allowlist and file size format", () => {
  assert.equal(isAllowedAttachmentType("image/jpeg"), true);
  assert.equal(isAllowedAttachmentType("video/mp4"), true);
  assert.equal(isAllowedAttachmentType("application/pdf"), true);
  assert.equal(isAllowedAttachmentType("application/zip"), false);

  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(1024), "1 KB");
  assert.equal(formatFileSize(2 * 1024 * 1024), "2.00 MB");

  assert.equal(TEMPLATE_COST.MARKETING, "Rp 818");
  assert.equal(TEMPLATE_COST.SERVICE, "Rp 0");
});

test("bubble utils map media label and time fallback", () => {
  assert.equal(renderMediaLabel(mockMessage("IMAGE")), "Gambar");
  assert.equal(renderMediaLabel(mockMessage("VIDEO")), "Video");
  assert.equal(renderMediaLabel(mockMessage("AUDIO")), "Audio");
  assert.equal(renderMediaLabel(mockMessage("DOCUMENT", "proof.pdf")), "Dokumen: proof.pdf");
  assert.equal(renderMediaLabel(mockMessage("TEXT")), null);

  assert.equal(formatTime("invalid"), "-");
  assert.match(formatTime("2026-03-06T10:00:00.000Z"), /\d{1,2}[:.]\d{2}/);
});
