import { prisma } from "@/lib/db/prisma";

type AuditLogInput = {
  orgId: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  meta?: Record<string, unknown>;
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function safeMetaJson(meta: Record<string, unknown> | undefined): string {
  try {
    return JSON.stringify(meta ?? {});
  } catch {
    return "{}";
  }
}

export async function writeAuditLogSafe(input: AuditLogInput): Promise<void> {
  const orgId = normalize(input.orgId);
  const action = normalize(input.action);
  const entityType = normalize(input.entityType);
  const entityId = normalize(input.entityId);
  const actorUserId = normalize(input.actorUserId) || null;

  if (!orgId || !action || !entityType || !entityId) {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        actorUserId,
        action,
        entityType,
        entityId,
        metaJson: safeMetaJson(input.meta)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[audit] failed to write log ${action} for ${entityType}:${entityId} - ${message}`);
  }
}
