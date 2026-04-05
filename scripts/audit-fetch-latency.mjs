#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_BASE_URL?.trim() || "http://localhost:3000";
const email = process.env.AUDIT_EMAIL?.trim() || process.env.SMOKE_EMAIL?.trim() || "owner@seed.20byte.local";
const password = process.env.AUDIT_PASSWORD?.trim() || process.env.SMOKE_PASSWORD?.trim() || "DemoPass123!";
const iterations = Number.parseInt(process.env.AUDIT_ITERATIONS ?? "16", 10);
const warmup = Number.parseInt(process.env.AUDIT_WARMUP ?? "3", 10);
const maxP95Ms = Number.parseInt(process.env.AUDIT_MAX_P95_MS ?? "1000", 10);

function parseServerTiming(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/dur=([0-9.]+)/);
  return match ? Number(match[1]) : null;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

async function main() {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`Login failed (${loginRes.status()}): ${body}`);
  }

  const cookieHeader = resolveSetCookies(loginRes.headers)
    .map((value) => value.split(";")[0])
    .join("; ");

  if (!cookieHeader) {
    throw new Error("Session cookie was not returned by /api/auth/login.");
  }

  async function request(pathname) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { cookie: cookieHeader }
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(1));
    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      payload,
      durationMs,
      serverTimingMs: parseServerTiming(response.headers.get("server-timing"))
    };
  }

  const orgRes = await request("/api/orgs");
  if (!orgRes.ok) {
    throw new Error(`Failed to load organizations (${orgRes.status}).`);
  }
  const orgId = orgRes.payload?.data?.organizations?.[0]?.id;
  if (!orgId) {
    throw new Error("No organization available for benchmark user.");
  }

  const listRes = await request(`/api/conversations?filter=UNASSIGNED&status=OPEN&page=1&limit=20&orgId=${encodeURIComponent(orgId)}`);
  if (!listRes.ok) {
    throw new Error(`Failed to load conversation list (${listRes.status}).`);
  }
  const firstConversation = listRes.payload?.data?.conversations?.[0] ?? null;
  if (!firstConversation?.id || !firstConversation?.customerId) {
    throw new Error("Seed conversation/customer not found. Run database seed first.");
  }

  const conversationId = firstConversation.id;
  const customerId = firstConversation.customerId;

  const endpoints = [
    {
      endpoint: "conversations.list",
      path: `/api/conversations?filter=UNASSIGNED&status=OPEN&page=1&limit=20&orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "conversation.detail",
      path: `/api/conversations/${encodeURIComponent(conversationId)}?orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "messages.list",
      path: `/api/messages?conversationId=${encodeURIComponent(conversationId)}&limit=30&orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "conversation.crm-context",
      path: `/api/conversations/${encodeURIComponent(conversationId)}/crm-context?orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "crm.board",
      path: `/api/crm/pipelines/board?status=OPEN&cardLimit=80&orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "customers.list",
      path: `/api/customers?page=1&limit=30&light=1&includeFacets=1&orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "customer.detail",
      path: `/api/customers/${encodeURIComponent(customerId)}?orgId=${encodeURIComponent(orgId)}`
    },
    {
      endpoint: "customer.tags",
      path: `/api/customers/${encodeURIComponent(customerId)}/tags?orgId=${encodeURIComponent(orgId)}`
    }
  ];

  const rows = [];
  for (const endpoint of endpoints) {
    const durations = [];
    const serverDurations = [];
    for (let index = 0; index < warmup + iterations; index += 1) {
      const result = await request(endpoint.path);
      if (!result.ok) {
        throw new Error(`${endpoint.endpoint} failed (${result.status}): ${JSON.stringify(result.payload)}`);
      }
      if (index < warmup) {
        continue;
      }
      durations.push(result.durationMs);
      if (typeof result.serverTimingMs === "number") {
        serverDurations.push(result.serverTimingMs);
      }
    }

    rows.push({
      endpoint: endpoint.endpoint,
      samples: durations.length,
      p50: Number(percentile(durations, 50).toFixed(1)),
      p95: Number(percentile(durations, 95).toFixed(1)),
      max: Number(Math.max(...durations).toFixed(1)),
      avg: Number(average(durations).toFixed(1)),
      serverP50: serverDurations.length > 0 ? Number(percentile(serverDurations, 50).toFixed(1)) : null,
      serverP95: serverDurations.length > 0 ? Number(percentile(serverDurations, 95).toFixed(1)) : null
    });
  }

  console.log(`Fetch latency audit (${baseUrl})`);
  console.table(rows);

  const outputDir = path.join(process.cwd(), "output", "perf");
  fs.mkdirSync(outputDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    iterations,
    warmup,
    maxP95Ms,
    rows
  };
  const latestPath = path.join(outputDir, "fetch-latency.latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
  console.log(`Saved report: ${latestPath}`);

  const overBudget = rows.filter((row) => row.p95 > maxP95Ms);
  if (overBudget.length > 0) {
    console.error(`Latency budget exceeded (p95 > ${maxP95Ms}ms):`);
    for (const row of overBudget) {
      console.error(`- ${row.endpoint}: p95=${row.p95}ms`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`All audited endpoints are within p95 <= ${maxP95Ms}ms.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
