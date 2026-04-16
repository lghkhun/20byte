import { BillingChargeStatus, PlatformRole, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { setSubscriptionActionBySuperadmin } from "@/server/services/billingService";
import { getStorageCleanupQueueSize } from "@/server/queues/cleanupQueue";
import { getMetaEventQueueSize } from "@/server/queues/metaEventQueue";
import { getWhatsAppMediaQueueSize } from "@/server/queues/mediaQueue";
import { ServiceError } from "@/server/services/serviceError";

function normalize(value: string): string {
  return value.trim();
}

function addDays(source: Date, days: number): Date {
  return new Date(source.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(source: Date): Date {
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
}

function dayKeyUtc(source: Date): string {
  const year = source.getUTCFullYear();
  const month = `${source.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${source.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveDueAt(status: SubscriptionStatus, trialEndAt: Date, currentPeriodEndAt: Date | null): Date | null {
  if (status === SubscriptionStatus.ACTIVE) {
    return currentPeriodEndAt;
  }
  if (status === SubscriptionStatus.TRIALING) {
    return trialEndAt;
  }

  return currentPeriodEndAt ?? trialEndAt;
}

export async function listSubscriptionsForSuperadmin() {
  const rows = await prisma.orgSubscription.findMany({
    include: {
      org: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          billingCharges: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            select: {
              id: true,
              status: true,
              totalAmountCents: true,
              createdAt: true,
              paidAt: true
            }
          },
          _count: {
            select: {
              members: true,
              waAccounts: true
            }
          }
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return rows;
}

export async function listUsersForSuperadmin() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phoneE164: true,
      name: true,
      isSuspended: true,
      createdAt: true,
      platformMembership: {
        select: {
          role: true,
          createdAt: true
        }
      },
      memberships: {
        select: {
          orgId: true,
          role: true,
          org: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 200
  });

  return users;
}

export async function listBillingChargesForSuperadmin(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return prisma.billingCharge.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit,
    select: {
      id: true,
      orgId: true,
      orderId: true,
      status: true,
      paymentMethod: true,
      gatewayProvider: true,
      baseAmountCents: true,
      gatewayFeeCents: true,
      totalAmountCents: true,
      paymentNumber: true,
      expiredAt: true,
      paidAt: true,
      createdAt: true,
      org: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function listInvoicePaymentAttemptsForSuperadmin(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return prisma.invoicePaymentAttempt.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit,
    select: {
      id: true,
      orgId: true,
      invoiceId: true,
      orderId: true,
      provider: true,
      paymentMethod: true,
      status: true,
      feePolicy: true,
      invoiceAmountCents: true,
      feeCents: true,
      customerPayableCents: true,
      paymentNumber: true,
      expiresAt: true,
      paidAt: true,
      createdAt: true,
      org: {
        select: {
          name: true
        }
      },
      invoice: {
        select: {
          invoiceNo: true,
          customer: {
            select: {
              displayName: true,
              phoneE164: true
            }
          }
        }
      }
    }
  });
}

export async function listWalletTopupsForSuperadmin(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return prisma.orgWalletTopup.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit,
    select: {
      id: true,
      orgId: true,
      orderId: true,
      amountCents: true,
      feeCents: true,
      customerPayableCents: true,
      paymentMethod: true,
      paymentNumber: true,
      status: true,
      expiresAt: true,
      paidAt: true,
      createdAt: true,
      org: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function listWalletWithdrawRequestsForSuperadmin(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return prisma.orgWalletWithdrawRequest.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit,
    select: {
      id: true,
      orgId: true,
      amountCents: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      status: true,
      note: true,
      processedNote: true,
      requestedByUserId: true,
      processedByUserId: true,
      processedAt: true,
      createdAt: true,
      org: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function getSuperadminOverview() {
  const now = new Date();
  const start30 = startOfUtcDay(addDays(now, -29));
  const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stalePendingCutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const [subscriptions, paidCharges30, orgs30, paidLast24h, chargesLast24h, pendingCount, expiredPendingCount, stalePendingCount, webhookLogs24h, latestWebhookEvents] = await Promise.all([
    prisma.orgSubscription.findMany({
      include: {
        org: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                members: true,
                waAccounts: true
              }
            }
          }
        }
      }
    }),
    prisma.billingCharge.findMany({
      where: {
        status: BillingChargeStatus.PAID,
        paidAt: {
          gte: start30
        }
      },
      select: {
        paidAt: true,
        totalAmountCents: true
      }
    }),
    prisma.org.findMany({
      where: {
        createdAt: {
          gte: start30
        }
      },
      select: {
        createdAt: true
      }
    }),
    prisma.billingCharge.count({
      where: {
        status: BillingChargeStatus.PAID,
        paidAt: {
          gte: start24h
        }
      }
    }),
    prisma.billingCharge.count({
      where: {
        createdAt: {
          gte: start24h
        }
      }
    }),
    prisma.billingCharge.count({
      where: {
        status: BillingChargeStatus.PENDING
      }
    }),
    prisma.billingCharge.count({
      where: {
        status: BillingChargeStatus.PENDING,
        expiredAt: {
          lt: now
        }
      }
    }),
    prisma.billingCharge.count({
      where: {
        status: BillingChargeStatus.PENDING,
        createdAt: {
          lt: stalePendingCutoff
        }
      }
    }),
    prisma.platformAuditLog.findMany({
      where: {
        targetType: "billing_webhook",
        createdAt: {
          gte: start24h
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        action: true,
        targetId: true,
        createdAt: true,
        metaJson: true
      }
    }),
    prisma.platformAuditLog.findMany({
      where: {
        targetType: "billing_webhook"
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 25,
      select: {
        id: true,
        action: true,
        targetId: true,
        createdAt: true,
        metaJson: true
      }
    })
  ]);

  const paidByDay = new Map<string, { count: number; amountCents: number }>();
  for (const charge of paidCharges30) {
    if (!charge.paidAt) {
      continue;
    }
    const key = dayKeyUtc(charge.paidAt);
    const existing = paidByDay.get(key) ?? { count: 0, amountCents: 0 };
    existing.count += 1;
    existing.amountCents += charge.totalAmountCents;
    paidByDay.set(key, existing);
  }

  const orgByDay = new Map<string, number>();
  for (const org of orgs30) {
    const key = dayKeyUtc(org.createdAt);
    orgByDay.set(key, (orgByDay.get(key) ?? 0) + 1);
  }

  const trend30: Array<{ date: string; paidCount: number; paidAmountCents: number; newOrgs: number }> = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = startOfUtcDay(addDays(now, -offset));
    const key = dayKeyUtc(day);
    const paid = paidByDay.get(key) ?? { count: 0, amountCents: 0 };
    trend30.push({
      date: key,
      paidCount: paid.count,
      paidAmountCents: paid.amountCents,
      newOrgs: orgByDay.get(key) ?? 0
    });
  }

  const trend7 = trend30.slice(-7);

  const statusSummary = {
    totalOrgs: subscriptions.length,
    active: subscriptions.filter((item) => item.status === SubscriptionStatus.ACTIVE).length,
    trialing: subscriptions.filter((item) => item.status === SubscriptionStatus.TRIALING).length,
    pastDue: subscriptions.filter((item) => item.status === SubscriptionStatus.PAST_DUE).length,
    canceled: subscriptions.filter((item) => item.status === SubscriptionStatus.CANCELED).length,
    connectedWhatsappOrgs: subscriptions.filter((item) => item.org._count.waAccounts > 0).length
  };

  const riskOrgs = subscriptions
    .map((item) => {
      const dueAt = resolveDueAt(item.status, item.trialEndAt, item.currentPeriodEndAt);
      const daysToDue = dueAt ? Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;
      const noWhatsapp = item.org._count.waAccounts === 0;

      let riskLevel: "high" | "medium" | "low" | null = null;
      let reason = "";
      if (item.status === SubscriptionStatus.PAST_DUE || item.status === SubscriptionStatus.CANCELED) {
        riskLevel = "high";
        reason = "Subscription tidak aktif (past due/canceled).";
      } else if (typeof daysToDue === "number" && daysToDue <= 3) {
        riskLevel = "medium";
        reason = `Jatuh tempo dalam ${Math.max(0, daysToDue)} hari.`;
      } else if (noWhatsapp) {
        riskLevel = "low";
        reason = "Belum ada WhatsApp org yang terkoneksi.";
      }

      return {
        orgId: item.orgId,
        orgName: item.org.name,
        status: item.status,
        dueAt,
        daysToDue,
        waAccounts: item.org._count.waAccounts,
        members: item.org._count.members,
        riskLevel,
        reason
      };
    })
    .filter((item): item is {
      orgId: string;
      orgName: string;
      status: SubscriptionStatus;
      dueAt: Date | null;
      daysToDue: number | null;
      waAccounts: number;
      members: number;
      riskLevel: "high" | "medium" | "low";
      reason: string;
    } => Boolean(item.riskLevel))
    .sort((left, right) => {
      const score = { high: 3, medium: 2, low: 1 };
      const riskDiff = score[right.riskLevel] - score[left.riskLevel];
      if (riskDiff !== 0) {
        return riskDiff;
      }
      const leftDue = left.dueAt ? left.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueAt ? right.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    })
    .slice(0, 30);

  const queueHealth = {
    redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
    redisReachable: false,
    metaEventQueue: null as number | null,
    mediaQueue: null as number | null,
    cleanupQueue: null as number | null,
    error: null as string | null
  };

  if (queueHealth.redisConfigured) {
    try {
      const [metaEventQueue, mediaQueue, cleanupQueue] = await Promise.all([
        getMetaEventQueueSize(),
        getWhatsAppMediaQueueSize(),
        getStorageCleanupQueueSize()
      ]);
      queueHealth.metaEventQueue = metaEventQueue;
      queueHealth.mediaQueue = mediaQueue;
      queueHealth.cleanupQueue = cleanupQueue;
      queueHealth.redisReachable = true;
    } catch (error) {
      queueHealth.error = error instanceof Error ? error.message : "Failed to read Redis queue depth.";
    }
  }

  const paymentHealth = {
    createdLast24h: chargesLast24h,
    paidLast24h,
    pending: pendingCount,
    pendingExpired: expiredPendingCount,
    pendingStaleOver1h: stalePendingCount
  };

  const webhookReceivedByOrder = new Map<string, number>();
  let receivedLast24h = 0;
  let completedLast24h = 0;
  let failedLast24h = 0;
  let replayLast24h = 0;
  for (const item of webhookLogs24h) {
    if (item.action === "pakasir.webhook.received") {
      receivedLast24h += 1;
      webhookReceivedByOrder.set(item.targetId, (webhookReceivedByOrder.get(item.targetId) ?? 0) + 1);
      continue;
    }
    if (item.action === "pakasir.webhook.completed") {
      completedLast24h += 1;
      continue;
    }
    if (item.action === "pakasir.webhook.replay_skipped") {
      replayLast24h += 1;
      continue;
    }
    if (item.action === "pakasir.webhook.verification_failed" || item.action === "pakasir.webhook.charge_not_found") {
      failedLast24h += 1;
    }
  }
  const retriedOrdersLast24h = Array.from(webhookReceivedByOrder.values()).filter((count) => count > 1).length;

  const webhookHealth = {
    receivedLast24h,
    completedLast24h,
    failedLast24h,
    replaySkippedLast24h: replayLast24h,
    retriedOrdersLast24h
  };

  const webhookEvents = latestWebhookEvents.map((item) => ({
    id: item.id,
    orderId: item.targetId,
    action: item.action,
    createdAt: item.createdAt,
    meta: parseJsonObject(item.metaJson)
  }));

  return {
    generatedAt: now,
    statusSummary,
    trends: {
      sevenDays: trend7,
      thirtyDays: trend30
    },
    queueHealth,
    paymentHealth,
    webhookHealth,
    webhookEvents,
    riskOrgs
  };
}

export type PlatformAuditLogListInput = {
  limit?: number | null;
  query?: string | null;
  action?: string | null;
  targetType?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
};

export async function listPlatformAuditLogs(input: PlatformAuditLogListInput = {}) {
  const limitRaw = Number.isFinite(input.limit) ? Number(input.limit) : 100;
  const limit = Math.max(1, Math.min(1000, Math.floor(limitRaw)));
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const action = typeof input.action === "string" ? input.action.trim() : "";
  const targetType = typeof input.targetType === "string" ? input.targetType.trim() : "";
  const dateFrom = input.dateFrom ?? null;
  const dateTo = input.dateTo ?? null;

  const userQueryMatches = query
    ? await prisma.user.findMany({
      where: {
        OR: [
          {
            email: {
              contains: query
            }
          },
          {
            name: {
              contains: query
            }
          }
        ]
      },
      select: {
        id: true
      },
      take: 50
    })
    : [];
  const matchedUserIds = userQueryMatches.map((item) => item.id);

  const logs = await prisma.platformAuditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      ...(dateFrom || dateTo
        ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {})
          }
        }
        : {}),
      ...(query
        ? {
          OR: [
            { actorUserId: { contains: query } },
            { action: { contains: query } },
            { targetType: { contains: query } },
            { targetId: { contains: query } },
            { metaJson: { contains: query } },
            ...(matchedUserIds.length > 0 ? [{ actorUserId: { in: matchedUserIds } }] : [])
          ]
        }
        : {})
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    select: {
      id: true,
      actorUserId: true,
      action: true,
      targetType: true,
      targetId: true,
      metaJson: true,
      createdAt: true
    }
  });

  const actorIds = Array.from(new Set(logs.map((item) => item.actorUserId)));
  const actors = actorIds.length
    ? await prisma.user.findMany({
      where: {
        id: {
          in: actorIds
        }
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    })
    : [];

  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  return logs.map((item) => {
    const actor = actorMap.get(item.actorUserId);
    return {
      ...item,
      actor: actor
        ? {
          id: actor.id,
          email: actor.email,
          name: actor.name
        }
        : null,
      meta: parseJsonObject(item.metaJson)
    };
  });
}

export async function applySubscriptionActionBySuperadmin(input: {
  actorUserId: string;
  orgId: string;
  action: "MARK_ACTIVE" | "MARK_PAST_DUE" | "CANCEL" | "EXTEND_TRIAL";
  extendDays?: number;
}) {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  const updated = await setSubscriptionActionBySuperadmin({
    orgId,
    action: input.action,
    extendDays: input.extendDays
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: `subscription.${input.action.toLowerCase()}`,
      targetType: "org_subscription",
      targetId: orgId,
      metaJson: JSON.stringify({
        action: input.action,
        extendDays: input.extendDays ?? null,
        status: updated.status
      })
    }
  });

  return updated;
}

export async function upsertPlatformMember(input: {
  actorUserId: string;
  userId: string;
  enabled: boolean;
}) {
  const userId = normalize(input.userId);
  if (!userId) {
    throw new ServiceError(400, "MISSING_USER_ID", "userId is required.");
  }

  if (input.enabled) {
    const member = await prisma.platformMember.upsert({
      where: { userId },
      create: {
        userId,
        role: PlatformRole.SUPERADMIN,
        createdByUserId: input.actorUserId
      },
      update: {
        role: PlatformRole.SUPERADMIN
      }
    });

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "platform_member.grant",
        targetType: "user",
        targetId: userId,
        metaJson: JSON.stringify({ role: member.role })
      }
    });

    return member;
  }

  await prisma.platformMember.deleteMany({
    where: { userId }
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "platform_member.revoke",
      targetType: "user",
      targetId: userId,
      metaJson: JSON.stringify({})
    }
  });

  return null;
}

export function parseSuperadminSubscriptionAction(value: unknown): "MARK_ACTIVE" | "MARK_PAST_DUE" | "CANCEL" | "EXTEND_TRIAL" | null {
  if (typeof value !== "string") {
    return null;
  }

  if (value === "MARK_ACTIVE" || value === "MARK_PAST_DUE" || value === "CANCEL" || value === "EXTEND_TRIAL") {
    return value;
  }

  return null;
}

export const SuperadminSubscriptionStatuses = SubscriptionStatus;
