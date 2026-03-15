import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { ServiceError } from "@/server/services/serviceError";

type PipelineStageItem = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type CrmPipelineItem = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageItem[];
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

async function requireCrmAccess(userId: string, orgId: string) {
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
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this business.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_CRM_ACCESS", "Your role cannot manage CRM pipelines.");
  }
}

function mapPipeline(row: {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Array<{ id: string; name: string; color: string; position: number }>;
}): CrmPipelineItem {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    stages: row.stages
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        position: stage.position
      }))
  };
}

export async function ensureDefaultCrmPipeline(orgId: string): Promise<void> {
  const existing = await prisma.crmPipeline.findFirst({
    where: { orgId },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  await prisma.crmPipeline.create({
    data: {
      orgId,
      name: "Pipellead default",
      isDefault: true,
      stages: {
        create: [
          { orgId, name: "Inisiasi Chat", color: "sky", position: 0 },
          { orgId, name: "Invoice", color: "amber", position: 1 },
          { orgId, name: "Follow Up", color: "emerald", position: 2 },
          { orgId, name: "Sudah Bayar", color: "violet", position: 3 }
        ]
      }
    }
  });
}

export async function listCrmPipelines(actorUserId: string, orgIdInput: string): Promise<CrmPipelineItem[]> {
  const orgId = normalize(orgIdInput);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  await requireCrmAccess(actorUserId, orgId);
  await ensureDefaultCrmPipeline(orgId);

  const rows = await prisma.crmPipeline.findMany({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true
        }
      }
    }
  });

  return rows.map(mapPipeline);
}

export async function createCrmPipeline(input: {
  actorUserId: string;
  orgId: string;
  name: string;
}): Promise<CrmPipelineItem> {
  const orgId = normalize(input.orgId);
  const name = normalize(input.name);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }
  if (!name) {
    throw new ServiceError(400, "MISSING_PIPELINE_NAME", "Pipeline name is required.");
  }

  await requireCrmAccess(input.actorUserId, orgId);
  await ensureDefaultCrmPipeline(orgId);

  const created = await prisma.crmPipeline.create({
    data: {
      orgId,
      name,
      stages: {
        create: [{ orgId, name: "Tahap Awal", color: "emerald", position: 0 }]
      }
    },
    select: {
      id: true,
      name: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true
        }
      }
    }
  });

  return mapPipeline(created);
}

export async function createCrmPipelineStage(input: {
  actorUserId: string;
  orgId: string;
  pipelineId: string;
  name: string;
  color?: string;
}): Promise<CrmPipelineItem> {
  const orgId = normalize(input.orgId);
  const pipelineId = normalize(input.pipelineId);
  const name = normalize(input.name);
  if (!orgId || !pipelineId || !name) {
    throw new ServiceError(400, "INVALID_STAGE_INPUT", "Pipeline and stage name are required.");
  }

  await requireCrmAccess(input.actorUserId, orgId);

  const stageCount = await prisma.crmPipelineStage.count({
    where: {
      orgId,
      pipelineId
    }
  });

  await prisma.crmPipelineStage.create({
    data: {
      orgId,
      pipelineId,
      name,
      color: normalize(input.color) || "emerald",
      position: stageCount
    }
  });

  const pipeline = await prisma.crmPipeline.findFirst({
    where: {
      id: pipelineId,
      orgId
    },
    select: {
      id: true,
      name: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true
        }
      }
    }
  });

  if (!pipeline) {
    throw new ServiceError(404, "CRM_PIPELINE_NOT_FOUND", "CRM pipeline does not exist.");
  }

  return mapPipeline(pipeline);
}

export async function assignConversationPipeline(input: {
  actorUserId: string;
  orgId: string;
  conversationId: string;
  pipelineId: string;
  stageId: string;
}) {
  const orgId = normalize(input.orgId);
  const conversationId = normalize(input.conversationId);
  const pipelineId = normalize(input.pipelineId);
  const stageId = normalize(input.stageId);
  if (!orgId || !conversationId || !pipelineId || !stageId) {
    throw new ServiceError(400, "INVALID_PIPELINE_ASSIGNMENT", "conversationId, pipelineId, and stageId are required.");
  }

  await requireCrmAccess(input.actorUserId, orgId);

  const stage = await prisma.crmPipelineStage.findFirst({
    where: {
      id: stageId,
      orgId,
      pipelineId
    },
    select: {
      id: true
    }
  });

  if (!stage) {
    throw new ServiceError(404, "CRM_STAGE_NOT_FOUND", "CRM stage does not exist.");
  }

  const updateResult = await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      orgId
    },
    data: {
      crmPipelineId: pipelineId,
      crmStageId: stageId
    }
  });

  if (updateResult.count !== 1) {
    throw new ServiceError(404, "CONVERSATION_NOT_FOUND", "Conversation does not exist.");
  }
}
