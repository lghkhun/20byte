import { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";
import { randomBytes } from "crypto";

import { ServiceError } from "@/server/services/serviceError";
import type { CreateInvoiceItemInput, InvoiceMilestoneInput, NormalizedInvoiceItem, NormalizedMilestone } from "@/server/services/invoice/invoiceTypes";

export function normalize(value: string): string {
  return value.trim();
}

export function normalizeOptional(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalize(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeCurrency(value: string | undefined): string {
  return normalize(value ?? "IDR") || "IDR";
}

export function toPositiveInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ServiceError(400, "INVALID_AMOUNT", "Amount must be a positive number.");
  }

  return Math.floor(value);
}

export function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

export function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 20;
  }

  return Math.min(100, Math.floor(value));
}

export function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

export function createPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export function normalizeItems(items: CreateInvoiceItemInput[]): NormalizedInvoiceItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError(400, "INVOICE_ITEMS_REQUIRED", "At least one invoice item is required.");
  }

  return items.map((item) => {
    const name = normalize(item.name);
    if (!name) {
      throw new ServiceError(400, "INVALID_ITEM_NAME", "Item name is required.");
    }

    const qty = toPositiveInteger(item.qty);
    const priceCents = toPositiveInteger(item.priceCents);
    const amountCents = qty * priceCents;

    return {
      name,
      description: normalizeOptional(item.description) ?? null,
      qty,
      unit: normalizeOptional(item.unit) ?? null,
      priceCents,
      amountCents
    };
  });
}

function buildDefaultMilestones(kind: InvoiceKind, totalCents: number): NormalizedMilestone[] {
  if (kind === InvoiceKind.DP_AND_FINAL) {
    const dpAmount = Math.floor(totalCents / 2);
    return [
      { type: PaymentMilestoneType.DP, amountCents: dpAmount, dueDate: null, status: "PENDING" },
      { type: PaymentMilestoneType.FINAL, amountCents: totalCents - dpAmount, dueDate: null, status: "PENDING" }
    ];
  }

  return [{ type: PaymentMilestoneType.FULL, amountCents: totalCents, dueDate: null, status: "PENDING" }];
}

function validateMilestoneTypesForKind(kind: InvoiceKind, milestones: NormalizedMilestone[]): void {
  const typeSet = new Set(milestones.map((milestone) => milestone.type));

  if (kind === InvoiceKind.FULL) {
    if (milestones.length !== 1 || !typeSet.has(PaymentMilestoneType.FULL)) {
      throw new ServiceError(400, "INVALID_MILESTONE_TYPES", "FULL invoice must have exactly one FULL milestone.");
    }
    return;
  }

  if (milestones.length !== 2 || !typeSet.has(PaymentMilestoneType.DP) || !typeSet.has(PaymentMilestoneType.FINAL)) {
    throw new ServiceError(400, "INVALID_MILESTONE_TYPES", "DP_AND_FINAL invoice must have DP and FINAL milestones.");
  }
}

export function normalizeMilestones(kind: InvoiceKind, totalCents: number, milestones?: InvoiceMilestoneInput[]): NormalizedMilestone[] {
  const normalized =
    milestones && milestones.length > 0
      ? milestones.map((milestone) => ({
          type: milestone.type,
          amountCents: toPositiveInteger(milestone.amountCents),
          dueDate: milestone.dueDate ?? null,
          status: "PENDING" as const
        }))
      : buildDefaultMilestones(kind, totalCents);

  validateMilestoneTypesForKind(kind, normalized);

  const milestoneTotal = normalized.reduce((accumulator, milestone) => accumulator + milestone.amountCents, 0);
  if (milestoneTotal !== totalCents) {
    throw new ServiceError(400, "INVALID_MILESTONE_TOTAL", "Milestone total must match invoice total.");
  }

  return normalized;
}

export function buildPublicInvoiceUrl(publicToken: string): string {
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/i/${publicToken}`;
}

export function deriveInvoiceStatus(milestones: Array<{ status: string }>, currentStatus: InvoiceStatus): InvoiceStatus {
  if (currentStatus === InvoiceStatus.VOID) {
    return InvoiceStatus.VOID;
  }

  const paidCount = milestones.filter((item) => item.status === "PAID").length;
  if (paidCount === 0) {
    return InvoiceStatus.SENT;
  }

  if (paidCount === milestones.length) {
    return InvoiceStatus.PAID;
  }

  return InvoiceStatus.PARTIALLY_PAID;
}
