#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { writeSmokeReport } from "./smoke-report.mjs";

const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3001";
const email = process.env.SMOKE_EMAIL?.trim() || "";
const password = process.env.SMOKE_PASSWORD?.trim() || "";

if (!email || !password) {
  console.error("Missing credentials. Set SMOKE_EMAIL and SMOKE_PASSWORD.");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];

  let movedConversationId = null;
  let restoreStageId = null;
  let pipelineId = null;
  let orgId = null;

  const fetchBoard = async () => {
    const query = new URLSearchParams({
      status: "OPEN",
      ...(orgId ? { orgId } : {})
    });
    const response = await context.request.get(`${baseUrl}/api/crm/pipelines/board?${query.toString()}`);
    if (!response.ok()) {
      throw new Error(`Failed to fetch CRM board (${response.status()}).`);
    }
    const payload = await response.json().catch(() => null);
    return payload?.data?.board ?? null;
  };

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    await page.goto(`${baseUrl}/crm/pipelines`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /CRM Pipeline/i }).waitFor({ timeout: 15_000 });

    const orgRes = await context.request.get(`${baseUrl}/api/orgs`);
    if (!orgRes.ok()) {
      throw new Error(`Failed to load organizations (${orgRes.status()}).`);
    }
    const orgPayload = await orgRes.json().catch(() => null);
    orgId = orgPayload?.data?.organizations?.[0]?.id ?? null;

    const board = await fetchBoard();
    if (!board?.pipeline?.id || !Array.isArray(board.columns) || board.columns.length < 2) {
      failures.push("Pipeline deep: board/pipeline is unavailable or has less than 2 stages.");
    } else {
      pipelineId = board.pipeline.id;
      const sourceColumn = board.columns.find((column) => Array.isArray(column.cards) && column.cards.length > 0) ?? null;
      const targetColumn = board.columns.find((column) => sourceColumn && column.stageId !== sourceColumn.stageId) ?? null;

      if (!sourceColumn || !targetColumn) {
        failures.push("Pipeline deep: no movable card/stage pair found.");
      } else {
        const card = sourceColumn.cards[0];
        movedConversationId = card.id;
        restoreStageId = sourceColumn.stageId;

        const moveRes = await context.request.patch(`${baseUrl}/api/conversations/${encodeURIComponent(card.id)}/pipeline`, {
          data: {
            orgId,
            pipelineId,
            stageId: targetColumn.stageId
          }
        });
        if (!moveRes.ok()) {
          failures.push(`Pipeline deep: move request failed (${moveRes.status()}).`);
        } else {
          const movedBoard = await fetchBoard();
          const movedIntoTarget = movedBoard?.columns?.some(
            (column) => column.stageId === targetColumn.stageId && column.cards?.some((item) => item.id === card.id)
          );
          if (!movedIntoTarget) {
            failures.push("Pipeline deep: conversation was not found in target stage after move.");
          }
        }
      }
    }
  } finally {
    if (movedConversationId && restoreStageId && pipelineId) {
      try {
        await context.request.patch(`${baseUrl}/api/conversations/${encodeURIComponent(movedConversationId)}/pipeline`, {
          data: {
            orgId,
            pipelineId,
            stageId: restoreStageId
          }
        });
      } catch {
        // best-effort restore only
      }
    }
    await browser.close();
  }

  return {
    failures
  };
}

const startedAtMs = Date.now();
try {
  const result = await main();
  if (result.failures.length > 0) {
    console.error("Pipeline deep smoke checks failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    await writeSmokeReport({
      suite: "smoke-ui-pipeline-deep",
      startedAtMs,
      status: "failed",
      baseUrl,
      failures: result.failures
    });
    process.exit(1);
  }

  console.log("Pipeline deep smoke checks passed.");
  await writeSmokeReport({
    suite: "smoke-ui-pipeline-deep",
    startedAtMs,
    status: "passed",
    baseUrl,
    failures: []
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeSmokeReport({
    suite: "smoke-ui-pipeline-deep",
    startedAtMs,
    status: "failed",
    baseUrl,
    failures: [message],
    error: message
  });
  throw error;
}
