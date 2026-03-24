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

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    await page.goto(`${baseUrl}/invoices`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Invoice System/i }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: /^Create Invoice$/i }).click();
    const createDialog = page.getByRole("dialog", { name: /Create Invoice from Invoices/i });
    await createDialog.waitFor({ timeout: 10_000 });

    await page.locator("text=Searching customers...").first().waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});

    const firstCustomerButton = createDialog.locator("button").filter({ hasText: /existing convo|no convo/i }).first();
    const hasCustomerButton = (await firstCustomerButton.count()) > 0;
    if (!hasCustomerButton) {
      failures.push("Invoices deep: customer picker has no selectable customer.");
    } else {
      await firstCustomerButton.click();
      const continueButton = createDialog.getByRole("button", { name: /^Continue$/i });
      await continueButton.click();

      const saveInvoiceButton = page.getByRole("button", { name: /Simpan Invoice|Menyimpan.../i }).first();
      await saveInvoiceButton.waitFor({ timeout: 20_000 });

      const cancelButtons = page.getByRole("button", { name: /^Batalkan$/i });
      const cancelCount = await cancelButtons.count();
      if (cancelCount > 0) {
        await cancelButtons.nth(cancelCount - 1).click();
      } else {
        await page.keyboard.press("Escape");
      }

      await saveInvoiceButton.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    }
  } finally {
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
    console.error("Invoices deep smoke checks failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    await writeSmokeReport({
      suite: "smoke-ui-invoices-deep",
      startedAtMs,
      status: "failed",
      baseUrl,
      failures: result.failures
    });
    process.exit(1);
  }

  console.log("Invoices deep smoke checks passed.");
  await writeSmokeReport({
    suite: "smoke-ui-invoices-deep",
    startedAtMs,
    status: "passed",
    baseUrl,
    failures: []
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeSmokeReport({
    suite: "smoke-ui-invoices-deep",
    startedAtMs,
    status: "failed",
    baseUrl,
    failures: [message],
    error: message
  });
  throw error;
}
