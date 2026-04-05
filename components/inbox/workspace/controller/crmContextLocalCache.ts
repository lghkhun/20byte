"use client";

import type { CustomerTagItem, CrmActivityItem, CrmInvoiceItem } from "@/components/inbox/workspace/types";

export type LocalConversationCrmContext = {
  customerId: string;
  tags: CustomerTagItem[];
  invoices: CrmInvoiceItem[];
  activity: CrmActivityItem[];
};

type StoredConversationCrmContext = {
  version: 1;
  orgId: string;
  conversationId: string;
  customerId: string;
  tags: CustomerTagItem[];
  invoices: CrmInvoiceItem[];
  activity: CrmActivityItem[];
  updatedAt: number;
  expiresAt: number;
};

const STORAGE_PREFIX = "inbox:crm-context:v1:";
const CRM_CONTEXT_TTL_MS = 12 * 60 * 60 * 1000;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function buildStorageKey(orgId: string, conversationId: string): string {
  return `${STORAGE_PREFIX}${normalize(orgId)}:${normalize(conversationId)}`;
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeTags(value: unknown): CustomerTagItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Partial<CustomerTagItem>;
      if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || typeof candidate.color !== "string") {
        return null;
      }

      return {
        id: candidate.id,
        name: candidate.name,
        color: candidate.color,
        isAssigned: Boolean(candidate.isAssigned)
      } satisfies CustomerTagItem;
    })
    .filter((item): item is CustomerTagItem => Boolean(item));
}

function sanitizeInvoices(value: unknown): CrmInvoiceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Partial<CrmInvoiceItem>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.invoiceNo !== "string" ||
        typeof candidate.status !== "string" ||
        typeof candidate.currency !== "string" ||
        typeof candidate.createdAt !== "string"
      ) {
        return null;
      }

      return {
        id: candidate.id,
        invoiceNo: candidate.invoiceNo,
        status: candidate.status,
        kind: candidate.kind === "DP_AND_FINAL" ? "DP_AND_FINAL" : "FULL",
        totalCents: toFiniteNumber(candidate.totalCents) ?? 0,
        currency: candidate.currency,
        proofCount: toFiniteNumber(candidate.proofCount) ?? 0,
        createdAt: candidate.createdAt
      } satisfies CrmInvoiceItem;
    })
    .filter((item): item is CrmInvoiceItem => Boolean(item));
}

function sanitizeActivity(value: unknown): CrmActivityItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Partial<CrmActivityItem>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.label !== "string" ||
        typeof candidate.time !== "string" ||
        typeof candidate.type !== "string"
      ) {
        return null;
      }

      return {
        id: candidate.id,
        type:
          candidate.type === "CONVERSATION_STARTED" ||
          candidate.type === "INVOICE_CREATED" ||
          candidate.type === "INVOICE_SENT" ||
          candidate.type === "PROOF_ATTACHED" ||
          candidate.type === "INVOICE_PAID"
            ? candidate.type
            : "CONVERSATION_STARTED",
        label: candidate.label,
        time: candidate.time
      } satisfies CrmActivityItem;
    })
    .filter((item): item is CrmActivityItem => Boolean(item));
}

function parseStoredPayload(raw: string | null): StoredConversationCrmContext | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConversationCrmContext>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.orgId !== "string" ||
      typeof parsed.conversationId !== "string" ||
      typeof parsed.customerId !== "string"
    ) {
      return null;
    }

    const expiresAt = toFiniteNumber(parsed.expiresAt) ?? 0;
    const updatedAt = toFiniteNumber(parsed.updatedAt) ?? Date.now();
    if (expiresAt <= Date.now()) {
      return null;
    }

    return {
      version: 1,
      orgId: parsed.orgId,
      conversationId: parsed.conversationId,
      customerId: parsed.customerId,
      tags: sanitizeTags(parsed.tags),
      invoices: sanitizeInvoices(parsed.invoices),
      activity: sanitizeActivity(parsed.activity),
      updatedAt,
      expiresAt
    };
  } catch {
    return null;
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

export function writeConversationCrmContextLocalCache(
  orgId: string,
  conversationId: string,
  context: LocalConversationCrmContext
): LocalConversationCrmContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedConversationId = normalize(conversationId);
  const normalizedCustomerId = normalize(context.customerId);
  if (!normalizedOrgId || !normalizedConversationId || !normalizedCustomerId) {
    return null;
  }

  const sanitized: LocalConversationCrmContext = {
    customerId: normalizedCustomerId,
    tags: sanitizeTags(context.tags),
    invoices: sanitizeInvoices(context.invoices),
    activity: sanitizeActivity(context.activity)
  };

  const now = Date.now();
  const storageKey = buildStorageKey(normalizedOrgId, normalizedConversationId);
  const payload: StoredConversationCrmContext = {
    version: 1,
    orgId: normalizedOrgId,
    conversationId: normalizedConversationId,
    customerId: sanitized.customerId,
    tags: sanitized.tags,
    invoices: sanitized.invoices,
    activity: sanitized.activity,
    updatedAt: now,
    expiresAt: now + CRM_CONTEXT_TTL_MS
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore localStorage quota/unavailable errors
  }

  return sanitized;
}

export function readConversationCrmContextLocalCache(
  orgId: string,
  conversationId: string,
  expectedCustomerId?: string | null
): LocalConversationCrmContext | null {
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

  const normalizedExpectedCustomerId = normalize(expectedCustomerId ?? "");
  if (normalizedExpectedCustomerId && parsed.customerId !== normalizedExpectedCustomerId) {
    return null;
  }

  return {
    customerId: parsed.customerId,
    tags: parsed.tags,
    invoices: parsed.invoices,
    activity: parsed.activity
  };
}

export function pruneConversationCrmContextLocalCache(): void {
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
      }
    });
  } catch {
    // ignore localStorage failures
  }
}

