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

  let originalDetailFrozen = null;
  let hasToggledDetail = false;

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    await page.goto(`${baseUrl}/customers`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Customer Management/i }).waitFor({ timeout: 15_000 });
    await page.locator("tbody tr").first().waitFor({ timeout: 20_000 });

    await page.getByRole("button", { name: /Table Layout/i }).click();
    const dialog = page.getByRole("dialog", { name: /Table Layout/i });
    await dialog.waitFor({ timeout: 10_000 });

    const detailLabel = dialog.getByText("Detail", { exact: true }).first();
    await detailLabel.waitFor({ timeout: 10_000 });
    const detailRow = detailLabel.locator("xpath=ancestor::div[contains(@class, 'flex items-center')][1]");
    const detailCheckbox = detailRow.getByRole("checkbox").first();
    await detailCheckbox.waitFor({ timeout: 10_000 });

    originalDetailFrozen = await detailCheckbox.isChecked();
    await detailCheckbox.click();
    hasToggledDetail = true;

    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Customer Management/i }).waitFor({ timeout: 15_000 });
    await page.locator("tbody tr").first().waitFor({ timeout: 20_000 });

    const hasDetailHeader = (await page.getByRole("columnheader", { name: /^Detail$/i }).count()) > 0;
    if (!hasDetailHeader) {
      failures.push("Customers deep: 'Detail' column disappeared after layout save/reload.");
    }

    await page.getByRole("button", { name: /Table Layout/i }).click();
    const verifyDialog = page.getByRole("dialog", { name: /Table Layout/i });
    await verifyDialog.waitFor({ timeout: 10_000 });
    const verifyDetailLabel = verifyDialog.getByText("Detail", { exact: true }).first();
    const verifyDetailRow = verifyDetailLabel.locator("xpath=ancestor::div[contains(@class, 'flex items-center')][1]");
    const verifyDetailCheckbox = verifyDetailRow.getByRole("checkbox").first();
    const toggledState = await verifyDetailCheckbox.isChecked();

    if (originalDetailFrozen !== null && toggledState === originalDetailFrozen) {
      failures.push("Customers deep: table layout checkbox state did not persist after reload.");
    }
  } finally {
    if (hasToggledDetail && originalDetailFrozen !== null) {
      try {
        await page.goto(`${baseUrl}/customers`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: /Customer Management/i }).waitFor({ timeout: 15_000 });
        await page.getByRole("button", { name: /Table Layout/i }).click();
        const restoreDialog = page.getByRole("dialog", { name: /Table Layout/i });
        await restoreDialog.waitFor({ timeout: 10_000 });
        const restoreDetailLabel = restoreDialog.getByText("Detail", { exact: true }).first();
        const restoreDetailRow = restoreDetailLabel.locator("xpath=ancestor::div[contains(@class, 'flex items-center')][1]");
        const restoreDetailCheckbox = restoreDetailRow.getByRole("checkbox").first();
        const currentState = await restoreDetailCheckbox.isChecked();
        if (currentState !== originalDetailFrozen) {
          await restoreDetailCheckbox.click();
        }
        await restoreDialog.getByRole("button", { name: /^Save$/i }).click();
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
    console.error("Customers deep smoke checks failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    await writeSmokeReport({
      suite: "smoke-ui-customers-deep",
      startedAtMs,
      status: "failed",
      baseUrl,
      failures: result.failures
    });
    process.exit(1);
  }

  console.log("Customers deep smoke checks passed.");
  await writeSmokeReport({
    suite: "smoke-ui-customers-deep",
    startedAtMs,
    status: "passed",
    baseUrl,
    failures: []
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeSmokeReport({
    suite: "smoke-ui-customers-deep",
    startedAtMs,
    status: "failed",
    baseUrl,
    failures: [message],
    error: message
  });
  throw error;
}
