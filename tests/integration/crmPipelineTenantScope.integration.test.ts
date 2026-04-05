import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createCrmPipelineStage } from "@/server/services/crmPipelineService";
import { ServiceError } from "@/server/services/serviceError";

const RUN_INTEGRATION = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const SEED_ORG_ID = "seed_org_alpha";
const SEED_ACTOR_USER_ID = "seed_user_admin";

test("crm pipeline stage creation rejects cross-org pipeline reference and leaves data intact", async (t) => {
  if (!RUN_INTEGRATION) {
    t.skip("Set RUN_DB_INTEGRATION_TESTS=1 to run DB-backed integration tests.");
    return;
  }

  await prisma.$connect();

  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId: SEED_ORG_ID,
        userId: SEED_ACTOR_USER_ID
      }
    },
    select: {
      id: true
    }
  });

  if (!membership) {
    t.skip("Seed membership not found. Run `npm run db:seed` first.");
    await prisma.$disconnect();
    return;
  }

  const tempOrgId = `it_crm_org_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const tempPipelineName = `[IT] Pipeline Scope ${Date.now()}`;
  const tempStageName = `[IT] Stage Scope ${Date.now()}`;
  let tempPipelineId: string | null = null;

  try {
    await prisma.org.create({
      data: {
        id: tempOrgId,
        name: `[IT] CRM Scope ${Date.now()}`
      }
    });

    await prisma.orgMember.create({
      data: {
        orgId: tempOrgId,
        userId: SEED_ACTOR_USER_ID,
        role: Role.OWNER
      }
    });

    const tempPipeline = await prisma.crmPipeline.create({
      data: {
        orgId: tempOrgId,
        name: tempPipelineName,
        isDefault: false
      },
      select: {
        id: true
      }
    });
    tempPipelineId = tempPipeline.id;

    await assert.rejects(
      () =>
        createCrmPipelineStage({
          actorUserId: SEED_ACTOR_USER_ID,
          orgId: SEED_ORG_ID,
          pipelineId: tempPipeline.id,
          name: tempStageName,
          color: "sky"
        }),
      (error: unknown) => {
        assert.ok(error instanceof ServiceError);
        assert.equal(error.code, "CRM_PIPELINE_NOT_FOUND");
        return true;
      }
    );

    const leakedStage = await prisma.crmPipelineStage.findFirst({
      where: {
        pipelineId: tempPipeline.id,
        name: tempStageName
      },
      select: {
        id: true
      }
    });
    assert.equal(leakedStage, null);
  } finally {
    if (tempPipelineId) {
      await prisma.crmPipelineStage.deleteMany({
        where: {
          pipelineId: tempPipelineId
        }
      });
      await prisma.crmPipeline.deleteMany({
        where: {
          id: tempPipelineId
        }
      });
    }

    await prisma.orgMember.deleteMany({
      where: {
        orgId: tempOrgId,
        userId: SEED_ACTOR_USER_ID
      }
    });
    await prisma.org.deleteMany({
      where: {
        id: tempOrgId
      }
    });

    await prisma.$disconnect();
  }
});
