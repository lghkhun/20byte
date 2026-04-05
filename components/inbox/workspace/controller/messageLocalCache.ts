"use client";

import type { MessageItem } from "@/components/inbox/types";

export type LocalConversationMessageCache = {
  rows: MessageItem[];
  hasMore: boolean;
  nextBeforeMessageId: string | null;
};

type StoredMessageEntry = {
  message: MessageItem;
  expiresAt: number;
};

type StoredConversationMessageCache = {
  version: 1;
  orgId: string;
  conversationId: string;
  hasMore: boolean;
  nextBeforeMessageId: string | null;
  entries: StoredMessageEntry[];
  updatedAt: number;
};

const STORAGE_PREFIX = "inbox:messages:v1:";
const MESSAGE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_CONVERSATION = 240;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function buildStorageKey(orgId: string, conversationId: string): string {
  return `${STORAGE_PREFIX}${normalize(orgId)}:${normalize(conversationId)}`;
}

function isLikelyMessageItem(value: unknown): value is MessageItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<MessageItem>;
  return typeof candidate.id === "string" && typeof candidate.createdAt === "string";
}

function getMessageCreatedAtMs(message: MessageItem): number {
  const parsed = Date.parse(message.createdAt);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Date.now();
}

function sortMessages(rows: MessageItem[]): MessageItem[] {
  return [...rows].sort((left, right) => {
    const timeDiff = getMessageCreatedAtMs(left) - getMessageCreatedAtMs(right);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return left.id.localeCompare(right.id);
  });
}

function dedupeByMessageId(rows: MessageItem[]): MessageItem[] {
  const deduped = new Map<string, MessageItem>();
  rows.forEach((row) => {
    deduped.set(row.id, row);
  });
  return [...deduped.values()];
}

function sanitizeMessagesForStorage(rows: MessageItem[], now: number): { rows: MessageItem[]; prunedCount: number } {
  const dedupedSorted = sortMessages(dedupeByMessageId(rows));
  let prunedCount = 0;

  const nonExpired = dedupedSorted.filter((message) => {
    const expiresAt = getMessageCreatedAtMs(message) + MESSAGE_TTL_MS;
    const keep = expiresAt > now;
    if (!keep) {
      prunedCount += 1;
    }
    return keep;
  });

  if (nonExpired.length <= MAX_MESSAGES_PER_CONVERSATION) {
    return { rows: nonExpired, prunedCount };
  }

  const overflow = nonExpired.length - MAX_MESSAGES_PER_CONVERSATION;
  prunedCount += overflow;
  return {
    rows: nonExpired.slice(overflow),
    prunedCount
  };
}

function toStoredEntries(rows: MessageItem[]): StoredMessageEntry[] {
  return rows.map((message) => ({
    message,
    expiresAt: getMessageCreatedAtMs(message) + MESSAGE_TTL_MS
  }));
}

function parseStoredPayload(raw: string | null): StoredConversationMessageCache | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConversationMessageCache>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.orgId !== "string" ||
      typeof parsed.conversationId !== "string" ||
      !Array.isArray(parsed.entries)
    ) {
      return null;
    }

    const entries: StoredMessageEntry[] = parsed.entries
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const candidate = entry as { message?: unknown; expiresAt?: unknown };
        if (!isLikelyMessageItem(candidate.message)) {
          return null;
        }
        const expiresAtValue = Number(candidate.expiresAt);
        return {
          message: candidate.message,
          expiresAt: Number.isFinite(expiresAtValue) ? expiresAtValue : getMessageCreatedAtMs(candidate.message) + MESSAGE_TTL_MS
        };
      })
      .filter((entry): entry is StoredMessageEntry => Boolean(entry));

    return {
      version: 1,
      orgId: parsed.orgId,
      conversationId: parsed.conversationId,
      hasMore: Boolean(parsed.hasMore),
      nextBeforeMessageId: normalize(parsed.nextBeforeMessageId ?? "") || null,
      entries,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : Date.now()
    };
  } catch {
    return null;
  }
}

function persistPayload(storageKey: string, payload: StoredConversationMessageCache): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore localStorage quota/unavailable errors
  }
}

function removePayload(storageKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore localStorage errors
  }
}

export function writeConversationMessagesLocalCache(
  orgId: string,
  conversationId: string,
  rows: MessageItem[],
  hasMore: boolean,
  nextBeforeMessageId: string | null
): LocalConversationMessageCache | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedConversationId = normalize(conversationId);
  if (!normalizedOrgId || !normalizedConversationId) {
    return null;
  }

  const now = Date.now();
  const sanitized = sanitizeMessagesForStorage(rows, now);
  if (sanitized.rows.length === 0) {
    removePayload(buildStorageKey(normalizedOrgId, normalizedConversationId));
    return null;
  }

  const effectiveHasMore = hasMore || sanitized.prunedCount > 0;
  const effectiveNextBeforeMessageId =
    normalize(nextBeforeMessageId ?? "") || (effectiveHasMore ? sanitized.rows[0]?.id ?? null : null);

  persistPayload(buildStorageKey(normalizedOrgId, normalizedConversationId), {
    version: 1,
    orgId: normalizedOrgId,
    conversationId: normalizedConversationId,
    hasMore: effectiveHasMore,
    nextBeforeMessageId: effectiveNextBeforeMessageId,
    entries: toStoredEntries(sanitized.rows),
    updatedAt: now
  });

  return {
    rows: sanitized.rows,
    hasMore: effectiveHasMore,
    nextBeforeMessageId: effectiveNextBeforeMessageId
  };
}

export function readConversationMessagesLocalCache(orgId: string, conversationId: string): LocalConversationMessageCache | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedConversationId = normalize(conversationId);
  if (!normalizedOrgId || !normalizedConversationId) {
    return null;
  }

  const storageKey = buildStorageKey(normalizedOrgId, normalizedConversationId);
  const parsed = parseStoredPayload(window.localStorage.getItem(storageKey));
  if (!parsed || parsed.orgId !== normalizedOrgId || parsed.conversationId !== normalizedConversationId) {
    removePayload(storageKey);
    return null;
  }

  const now = Date.now();
  const rowsFromEntries = parsed.entries
    .filter((entry) => Number.isFinite(entry.expiresAt) && entry.expiresAt > now)
    .map((entry) => entry.message);
  const sanitized = sanitizeMessagesForStorage(rowsFromEntries, now);

  if (sanitized.rows.length === 0) {
    removePayload(storageKey);
    return null;
  }

  const prunedCount = parsed.entries.length - rowsFromEntries.length + sanitized.prunedCount;
  const effectiveHasMore = parsed.hasMore || prunedCount > 0;
  const effectiveNextBeforeMessageId =
    normalize(parsed.nextBeforeMessageId ?? "") || (effectiveHasMore ? sanitized.rows[0]?.id ?? null : null);

  if (prunedCount > 0) {
    persistPayload(storageKey, {
      version: 1,
      orgId: normalizedOrgId,
      conversationId: normalizedConversationId,
      hasMore: effectiveHasMore,
      nextBeforeMessageId: effectiveNextBeforeMessageId,
      entries: toStoredEntries(sanitized.rows),
      updatedAt: now
    });
  }

  return {
    rows: sanitized.rows,
    hasMore: effectiveHasMore,
    nextBeforeMessageId: effectiveNextBeforeMessageId
  };
}

export function pruneConversationMessagesLocalCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      const parsed = parseStoredPayload(window.localStorage.getItem(key));
      if (!parsed) {
        removePayload(key);
        return;
      }

      const rows = parsed.entries.map((entry) => entry.message);
      const sanitized = sanitizeMessagesForStorage(rows, Date.now());
      if (sanitized.rows.length === 0) {
        removePayload(key);
        return;
      }

      const prunedCount = parsed.entries.length - sanitized.rows.length;
      if (prunedCount <= 0) {
        return;
      }

      const effectiveHasMore = parsed.hasMore || prunedCount > 0;
      const effectiveNextBeforeMessageId =
        normalize(parsed.nextBeforeMessageId ?? "") || (effectiveHasMore ? sanitized.rows[0]?.id ?? null : null);

      persistPayload(key, {
        version: 1,
        orgId: parsed.orgId,
        conversationId: parsed.conversationId,
        hasMore: effectiveHasMore,
        nextBeforeMessageId: effectiveNextBeforeMessageId,
        entries: toStoredEntries(sanitized.rows),
        updatedAt: Date.now()
      });
    });
  } catch {
    // ignore localStorage failures
  }
}
