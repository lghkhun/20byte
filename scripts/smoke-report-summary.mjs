#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportDir = path.join(process.cwd(), "output", "smoke");

function sortBySuiteName(a, b) {
  return a.suite.localeCompare(b.suite);
}

function timestampToken(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const entries = await readdir(reportDir, { withFileTypes: true }).catch(() => []);
  const latestFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".latest.json") && !entry.name.startsWith("index."))
    .map((entry) => entry.name);

  if (latestFiles.length === 0) {
    console.log("No smoke report found in output/smoke.");
    process.exit(1);
  }

  const reports = [];
  for (const fileName of latestFiles) {
    const fullPath = path.join(reportDir, fileName);
    const raw = await readFile(fullPath, "utf8");
    reports.push(JSON.parse(raw));
  }
  reports.sort(sortBySuiteName);

  const now = new Date();
  const counts = reports.reduce(
    (acc, report) => {
      if (report.status === "passed") acc.passed += 1;
      else if (report.status === "failed") acc.failed += 1;
      else if (report.status === "skipped") acc.skipped += 1;
      return acc;
    },
    { passed: 0, failed: 0, skipped: 0 }
  );
  const summary = {
    generatedAt: now.toISOString(),
    totals: {
      suites: reports.length,
      ...counts
    },
    reports
  };

  await mkdir(reportDir, { recursive: true });
  const latestSummaryPath = path.join(reportDir, "index.latest.json");
  const datedSummaryPath = path.join(reportDir, `index.${timestampToken(now)}.json`);
  const payload = `${JSON.stringify(summary, null, 2)}\n`;
  await Promise.all([writeFile(latestSummaryPath, payload, "utf8"), writeFile(datedSummaryPath, payload, "utf8")]);

  console.log("Smoke Report Summary");
  for (const report of reports) {
    const suffix = report.status === "skipped" && report.skippedReason ? ` (${report.skippedReason})` : "";
    console.log(`- ${report.suite}: ${report.status} (${report.durationMs}ms)${suffix}`);
  }
  console.log(`- totals: suites=${reports.length}, passed=${counts.passed}, failed=${counts.failed}, skipped=${counts.skipped}`);
  console.log(`- summary json: ${latestSummaryPath}`);

  const hasFailure = reports.some((report) => report.status === "failed");
  if (hasFailure) {
    process.exit(1);
  }
}

await main();
