import { BillingChargeStatus, Role, SubscriptionStatus } from "@prisma/client";

import { getPakasirConfig } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { acquireIdempotencyLock } from "@/lib/redis/idempotency";
import { ServiceError } from "@/server/services/serviceError";

const TRIAL_DAYS = 14;
const DEFAULT_GRACE_DAYS = 3;
const RENEWAL_DAYS = 28;
const DEFAULT_BASE_AMOUNT_CENTS = 99_000;
const DEFAULT_GATEWAY_FEE_BPS = 200;
const DEFAULT_CURRENCY = "IDR";
const WEBHOOK_ACTOR_USER_ID = "system:pakasir-webhook";

async function writeWebhookAuditLog(input: {
  action:
    | "pakasir.webhook.received"
    | "pakasir.webhook.replay_skipped"
    | "pakasir.webhook.charge_not_found"
    | "pakasir.webhook.already_paid"
    | "pakasir.webhook.verification_failed"
    | "pakasir.webhook.completed";
  orderId: string;
  meta: Record<string, unknown>;
}) {
  try {
    await prisma.platformAuditLog.create({
      data: {
        actorUserId: WEBHOOK_ACTOR_USER_ID,
        action: input.action,
        targetType: "billing_webhook",
        targetId: input.orderId,
        metaJson: JSON.stringify(input.meta)
      }
    });
  } catch {
    // best-effort observability, never block billing flow
  }
}

type PakasirCreateResponse = {
  payment?: {
    project?: string;
    order_id?: string;
    amount?: number;
    fee?: number;
    total_payment?: number;
    payment_method?: string;
    payment_number?: string;
    expired_at?: string;
  };
};

type PakasirDetailResponse = {
  transaction?: {
    amount?: number;
    order_id?: string;
    project?: string;
    status?: string;
    payment_method?: string;
    completed_at?: string;
  };
};

function normalize(value: string): string {
  return value.trim();
}

export function calculateGatewayFeeCents(baseAmountCents: number, feeBps = DEFAULT_GATEWAY_FEE_BPS): number {
  return Math.ceil((baseAmountCents * feeBps) / 10_000);
}

export function calculateTotalChargeCents(baseAmountCents: number, feeBps = DEFAULT_GATEWAY_FEE_BPS): number {
  return baseAmountCents + calculateGatewayFeeCents(baseAmountCents, feeBps);
}

function addDays(source: Date, days: number): Date {
  return new Date(source.getTime() + days * 24 * 60 * 60 * 1000);
}

export type SubscriptionAccessState = {
  status: SubscriptionStatus;
  trialEndAt: Date;
  graceEndAt: Date;
  currentPeriodEndAt: Date | null;
  isLocked: boolean;
};

export type SubscriptionReminderState = {
  shouldShowBanner: boolean;
  shouldBroadcastWhatsapp: boolean;
  dueAt: Date | null;
  daysRemaining: number | null;
  message: string;
};

export function computeSubscriptionAccessState(input: {
  status: SubscriptionStatus;
  trialEndAt: Date;
  graceDays: number;
  currentPeriodEndAt: Date | null;
  now?: Date;
}): SubscriptionAccessState {
  const now = input.now ?? new Date();
  const graceEndAt = addDays(input.trialEndAt, input.graceDays);
  const activePeriod = input.currentPeriodEndAt ? input.currentPeriodEndAt.getTime() > now.getTime() : false;

  let isLocked = false;
  if (input.status === SubscriptionStatus.CANCELED) {
    isLocked = true;
  } else if (input.status === SubscriptionStatus.ACTIVE) {
    isLocked = !activePeriod;
  } else if (input.status === SubscriptionStatus.TRIALING) {
    isLocked = now.getTime() > graceEndAt.getTime();
  } else if (input.status === SubscriptionStatus.PAST_DUE) {
    isLocked = true;
  }

  return {
    status: input.status,
    trialEndAt: input.trialEndAt,
    graceEndAt,
    currentPeriodEndAt: input.currentPeriodEndAt,
    isLocked
  };
}

async function getOrgSubscriptionOrThrow(orgId: string) {
  const subscription = await prisma.orgSubscription.findUnique({
    where: { orgId }
  });

  if (!subscription) {
    throw new ServiceError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription is not configured for this organization.");
  }

  return subscription;
}

async function requireOrgMembership(userId: string, orgId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  return membership;
}

async function requireOrgOwner(userId: string, orgId: string) {
  const membership = await requireOrgMembership(userId, orgId);
  if (membership.role !== Role.OWNER) {
    throw new ServiceError(403, "FORBIDDEN_OWNER_ONLY", "Only owner can access billing management.");
  }
}

function resolveSubscriptionDueAt(input: {
  status: SubscriptionStatus;
  trialEndAt: Date;
  currentPeriodEndAt: Date | null;
}): Date | null {
  if (input.status === SubscriptionStatus.ACTIVE) {
    return input.currentPeriodEndAt;
  }

  if (input.status === SubscriptionStatus.TRIALING) {
    return input.trialEndAt;
  }

  return input.currentPeriodEndAt ?? input.trialEndAt;
}

export function computeSubscriptionReminderState(input: {
  membershipRole: Role;
  status: SubscriptionStatus;
  trialEndAt: Date;
  currentPeriodEndAt: Date | null;
  now?: Date;
}): SubscriptionReminderState {
  const now = input.now ?? new Date();
  const dueAt = resolveSubscriptionDueAt({
    status: input.status,
    trialEndAt: input.trialEndAt,
    currentPeriodEndAt: input.currentPeriodEndAt
  });
  const isPastDue = input.status === SubscriptionStatus.PAST_DUE || input.status === SubscriptionStatus.CANCELED;
  const isOwner = input.membershipRole === Role.OWNER;

  let daysRemaining: number | null = null;
  let shouldWarnUpcoming = false;
  if (dueAt) {
    const remainingMs = dueAt.getTime() - now.getTime();
    const remainingDaysFloat = remainingMs / (24 * 60 * 60 * 1000);
    if (remainingDaysFloat >= 0) {
      daysRemaining = Math.ceil(remainingDaysFloat);
      shouldWarnUpcoming = daysRemaining <= 3;
    }
  }

  const shouldShowBanner = isPastDue || shouldWarnUpcoming;
  const shouldBroadcastWhatsapp = isPastDue || shouldWarnUpcoming;
  const dueDateLabel = dueAt
    ? dueAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
  const message = isPastDue
    ? isOwner
      ? "Langganan bisnis sudah jatuh tempo. Segera lakukan pembayaran agar akses tim kembali normal."
      : "Langganan bisnis sudah jatuh tempo. Hubungi owner untuk segera membayar tagihan agar akses tim kembali normal."
    : isOwner
      ? `Langganan bisnis akan berakhir pada ${dueDateLabel}. Segera lakukan pembayaran agar operasional tim tidak terhenti.`
      : `Langganan bisnis akan berakhir pada ${dueDateLabel}. Mohon hubungi owner untuk melakukan pembayaran tagihan.`;

  return {
    shouldShowBanner,
    shouldBroadcastWhatsapp,
    dueAt,
    daysRemaining,
    message
  };
}

export async function ensureBillingRecordForOrg(orgId: string, startsAt = new Date()) {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const trialStartAt = startsAt;
  const trialEndAt = addDays(startsAt, TRIAL_DAYS);

  return prisma.orgSubscription.upsert({
    where: { orgId: normalizedOrgId },
    create: {
      orgId: normalizedOrgId,
      status: SubscriptionStatus.TRIALING,
      trialStartAt,
      trialEndAt,
      graceDays: DEFAULT_GRACE_DAYS,
      baseAmountCents: DEFAULT_BASE_AMOUNT_CENTS,
      gatewayFeeBps: DEFAULT_GATEWAY_FEE_BPS,
      currency: DEFAULT_CURRENCY
    },
    update: {}
  });
}

export async function getOrgSubscriptionView(actorUserId: string, orgIdInput: string) {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const membership = await requireOrgMembership(actorUserId, orgId);
  const subscription = await getOrgSubscriptionOrThrow(orgId);
  const state = computeSubscriptionAccessState({
    status: subscription.status,
    trialEndAt: subscription.trialEndAt,
    graceDays: subscription.graceDays,
    currentPeriodEndAt: subscription.currentPeriodEndAt
  });
  const reminder = computeSubscriptionReminderState({
    membershipRole: membership.role,
    status: subscription.status,
    trialEndAt: subscription.trialEndAt,
    currentPeriodEndAt: subscription.currentPeriodEndAt
  });

  return {
    subscription,
    state,
    reminder,
    pricing: {
      baseAmountCents: subscription.baseAmountCents,
      gatewayFeeCents: calculateGatewayFeeCents(subscription.baseAmountCents, subscription.gatewayFeeBps),
      totalAmountCents: calculateTotalChargeCents(subscription.baseAmountCents, subscription.gatewayFeeBps),
      renewalDays: RENEWAL_DAYS,
      currency: subscription.currency
    }
  };
}

export async function assertOrgBillingAccess(orgIdInput: string, mode: "read" | "write" = "write"): Promise<void> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const subscription = await getOrgSubscriptionOrThrow(orgId);
  const state = computeSubscriptionAccessState({
    status: subscription.status,
    trialEndAt: subscription.trialEndAt,
    graceDays: subscription.graceDays,
    currentPeriodEndAt: subscription.currentPeriodEndAt
  });

  if (!state.isLocked) {
    return;
  }

  if (mode === "read") {
    return;
  }

  throw new ServiceError(402, "BILLING_LOCKED", "Organization access is locked due to subscription status.");
}

export async function listOrgBillingCharges(actorUserId: string, orgIdInput: string) {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireOrgOwner(actorUserId, orgId);
  return prisma.billingCharge.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
}

async function createPakasirTransaction(input: {
  orderId: string;
  amount: number;
  method: string;
}) {
  const config = getPakasirConfig();
  const response = await fetch(`${config.baseUrl}/api/transactioncreate/${encodeURIComponent(input.method)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      project: config.slug,
      order_id: input.orderId,
      amount: input.amount,
      api_key: config.apiKey
    })
  });

  const payload = (await response.json().catch(() => null)) as PakasirCreateResponse | null;
  if (!response.ok || !payload?.payment?.order_id) {
    throw new ServiceError(502, "PAKASIR_CREATE_FAILED", "Failed to create payment transaction.");
  }

  return payload;
}

export async function createBillingCheckout(input: {
  actorUserId: string;
  orgId: string;
  paymentMethod?: string;
}) {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireOrgOwner(input.actorUserId, orgId);
  const subscription = await getOrgSubscriptionOrThrow(orgId);
  const config = getPakasirConfig();
  const paymentMethod = normalize(input.paymentMethod ?? config.defaultMethod) || config.defaultMethod;
  const baseAmountCents = subscription.baseAmountCents;
  const gatewayFeeCents = calculateGatewayFeeCents(baseAmountCents, subscription.gatewayFeeBps);
  const totalAmountCents = baseAmountCents + gatewayFeeCents;
  const orderId = `SUB-${orgId}-${Date.now()}`;

  const gatewayPayload = await createPakasirTransaction({
    orderId,
    amount: totalAmountCents,
    method: paymentMethod
  });

  const charge = await prisma.billingCharge.create({
    data: {
      orgId,
      orderId,
      status: BillingChargeStatus.PENDING,
      baseAmountCents,
      gatewayFeeCents,
      totalAmountCents,
      paymentMethod,
      gatewayProvider: "pakasir",
      gatewayProjectSlug: config.slug,
      gatewayRawJson: JSON.stringify(gatewayPayload),
      paymentNumber: gatewayPayload.payment?.payment_number ?? null,
      expiredAt: gatewayPayload.payment?.expired_at ? new Date(gatewayPayload.payment.expired_at) : null,
      createdByUserId: input.actorUserId
    }
  });

  return {
    charge,
    payment: gatewayPayload.payment ?? null
  };
}

async function fetchPakasirTransactionDetail(input: {
  orderId: string;
  amount: number;
}): Promise<PakasirDetailResponse> {
  const config = getPakasirConfig();
  const params = new URLSearchParams({
    project: config.slug,
    amount: String(input.amount),
    order_id: input.orderId,
    api_key: config.apiKey
  });

  const response = await fetch(`${config.baseUrl}/api/transactiondetail?${params.toString()}`, {
    method: "GET"
  });
  const payload = (await response.json().catch(() => null)) as PakasirDetailResponse | null;
  if (!response.ok || !payload?.transaction) {
    throw new ServiceError(502, "PAKASIR_DETAIL_FAILED", "Failed to verify payment transaction.");
  }

  return payload;
}

async function activateSubscriptionFromPaidCharge(orgId: string, paidAt: Date) {
  const periodStart = paidAt;
  const periodEnd = addDays(periodStart, RENEWAL_DAYS);

  await prisma.orgSubscription.update({
    where: { orgId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStartAt: periodStart,
      currentPeriodEndAt: periodEnd,
      nextDueAt: periodEnd,
      lastPaidAt: paidAt
    }
  });
}

export async function processPakasirWebhook(input: {
  order_id?: unknown;
  amount?: unknown;
  status?: unknown;
}) {
  const orderId = typeof input.order_id === "string" ? input.order_id.trim() : "";
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount ?? 0);
  const status = typeof input.status === "string" ? input.status.toLowerCase() : "";

  if (!orderId || !Number.isFinite(amount) || amount <= 0 || !status) {
    throw new ServiceError(400, "INVALID_WEBHOOK_PAYLOAD", "Invalid Pakasir webhook payload.");
  }

  await writeWebhookAuditLog({
    action: "pakasir.webhook.received",
    orderId,
    meta: {
      amount,
      status
    }
  });

  const replayLockKey = `idmp:pakasir:webhook:${orderId}:${status}:${amount}`;
  const lockAcquired = await acquireIdempotencyLock(replayLockKey, 60 * 60 * 24);
  if (!lockAcquired) {
    await writeWebhookAuditLog({
      action: "pakasir.webhook.replay_skipped",
      orderId,
      meta: {
        amount,
        status
      }
    });
    return { charge: null, skipped: true, reason: "replay" };
  }

  const charge = await prisma.billingCharge.findUnique({ where: { orderId } });
  if (!charge) {
    await writeWebhookAuditLog({
      action: "pakasir.webhook.charge_not_found",
      orderId,
      meta: {
        amount,
        status
      }
    });
    throw new ServiceError(404, "BILLING_CHARGE_NOT_FOUND", "Billing charge not found.");
  }

  if (charge.status === BillingChargeStatus.PAID) {
    await writeWebhookAuditLog({
      action: "pakasir.webhook.already_paid",
      orderId,
      meta: {
        amount,
        status,
        chargeId: charge.id
      }
    });
    return { charge, skipped: true };
  }

  const detail = await fetchPakasirTransactionDetail({ orderId, amount });
  const transaction = detail.transaction;
  const isCompleted = transaction?.status?.toLowerCase() === "completed";
  const isAmountMatch = Number(transaction?.amount) === charge.totalAmountCents;

  if (!isCompleted || !isAmountMatch) {
    await writeWebhookAuditLog({
      action: "pakasir.webhook.verification_failed",
      orderId,
      meta: {
        amount,
        status,
        detailStatus: transaction?.status ?? null,
        detailAmount: transaction?.amount ?? null,
        expectedAmount: charge.totalAmountCents,
        chargeId: charge.id
      }
    });
    throw new ServiceError(400, "PAYMENT_VERIFICATION_FAILED", "Payment verification failed.");
  }

  const paidAt = transaction?.completed_at ? new Date(transaction.completed_at) : new Date();

  const updatedCharge = await prisma.billingCharge.update({
    where: { id: charge.id },
    data: {
      status: BillingChargeStatus.PAID,
      paidAt,
      gatewayRawJson: JSON.stringify({
        create: charge.gatewayRawJson ? JSON.parse(charge.gatewayRawJson) : null,
        detail
      })
    }
  });

  await activateSubscriptionFromPaidCharge(charge.orgId, paidAt);

  await writeWebhookAuditLog({
    action: "pakasir.webhook.completed",
    orderId,
    meta: {
      amount,
      status,
      chargeId: updatedCharge.id,
      orgId: updatedCharge.orgId,
      paidAt: paidAt.toISOString()
    }
  });

  return {
    charge: updatedCharge,
    skipped: false
  };
}

export async function runSubscriptionTransitionSweep(now = new Date()) {
  const subscriptions = await prisma.orgSubscription.findMany({
    where: {
      status: {
        in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE]
      }
    }
  });

  for (const subscription of subscriptions) {
    if (subscription.status === SubscriptionStatus.TRIALING) {
      const graceEndAt = addDays(subscription.trialEndAt, subscription.graceDays);
      if (now.getTime() > graceEndAt.getTime()) {
        await prisma.orgSubscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.PAST_DUE
          }
        });
      }
      continue;
    }

    if (subscription.status === SubscriptionStatus.ACTIVE && subscription.currentPeriodEndAt && now.getTime() > subscription.currentPeriodEndAt.getTime()) {
      await prisma.orgSubscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.PAST_DUE
        }
      });
    }
  }
}

export async function setSubscriptionActionBySuperadmin(input: {
  orgId: string;
  action: "MARK_ACTIVE" | "MARK_PAST_DUE" | "CANCEL" | "EXTEND_TRIAL";
  extendDays?: number;
}) {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const subscription = await getOrgSubscriptionOrThrow(orgId);

  if (input.action === "MARK_ACTIVE") {
    const start = new Date();
    const end = addDays(start, RENEWAL_DAYS);
    return prisma.orgSubscription.update({
      where: { orgId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStartAt: start,
        currentPeriodEndAt: end,
        nextDueAt: end
      }
    });
  }

  if (input.action === "MARK_PAST_DUE") {
    return prisma.orgSubscription.update({
      where: { orgId },
      data: {
        status: SubscriptionStatus.PAST_DUE
      }
    });
  }

  if (input.action === "CANCEL") {
    return prisma.orgSubscription.update({
      where: { orgId },
      data: {
        status: SubscriptionStatus.CANCELED
      }
    });
  }

  const extendDays = Number.isFinite(input.extendDays) ? Math.max(1, Math.floor(input.extendDays ?? 0)) : 1;
  return prisma.orgSubscription.update({
    where: { orgId },
    data: {
      status: SubscriptionStatus.TRIALING,
      trialEndAt: addDays(subscription.trialEndAt, extendDays)
    }
  });
}
