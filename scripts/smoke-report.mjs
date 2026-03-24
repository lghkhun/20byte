#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sanitizeSuiteName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function timestampToken(date) {
  const iso = date.toISOString();
  return iso.replace(/[:.]/g, "-");
}

export async function writeSmokeReport({
  suite,
  startedAtMs,
  status,
  baseUrl,
  failures = [],
  skippedReason = null,
  error = null,
  meta = {}
}) {
  const endedAt = new Date();
  const startedAt = new Date(startedAtMs);
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const safeSuite = sanitizeSuiteName(suite);
  const report = {
    suite,
    status,
    baseUrl,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs,
    failures,
    skippedReason,
    error,
    meta
  };

  const reportDir = path.join(process.cwd(), "output", "smoke");
  await mkdir(reportDir, { recursive: true });

  const latestPath = path.join(reportDir, `${safeSuite}.latest.json`);
  const datedPath = path.join(reportDir, `${safeSuite}.${timestampToken(endedAt)}.json`);
  const payload = `${JSON.stringify(report, null, 2)}\n`;

  await Promise.all([writeFile(latestPath, payload, "utf8"), writeFile(datedPath, payload, "utf8")]);
  return {
    latestPath,
    datedPath
  };
}
