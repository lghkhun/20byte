import { Rest } from "ably";

import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { ServiceError } from "@/server/services/serviceError";

type AblyTokenRequestResult = {
  keyName: string;
  ttl: number;
  capability: string;
  clientId: string;
  nonce: string;
  timestamp: number;
  mac: string;
};

function normalize(value: string): string {
  return value.trim();
}

function getAblyServerClient(): Rest {
  const apiKey = process.env.ABLY_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceError(500, "ABLY_NOT_CONFIGURED", "Ably API key is not configured.");
  }

  return new Rest(apiKey);
}

async function requireInboxMembership(actorUserId: string, orgId: string): Promise<{ role: string }> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: actorUserId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INBOX_ACCESS", "Your role cannot access inbox conversations.");
  }

  return membership;
}

export async function createInboxRealtimeTokenRequest(
  actorUserId: string,
  orgIdInput: string
): Promise<AblyTokenRequestResult> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireInboxMembership(actorUserId, orgId);

  const capability = JSON.stringify({
    [`org:${orgId}`]: ["subscribe"]
  });

  const client = getAblyServerClient();
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: actorUserId,
    capability,
    ttl: 60 * 60 * 1000
  });

  return tokenRequest as AblyTokenRequestResult;
}

