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

/**
 * @param {import("@playwright/test").Locator} locator
 * @param {import("@playwright/test").Page} page
 * @param {number} timeoutMs
 */
async function waitForConnectedBaileysPhone(locator, page, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastText = "";

  while (Date.now() - startedAt < timeoutMs) {
    const nextText = (await locator.textContent().catch(() => ""))?.trim() ?? "";
    lastText = nextText;
    const isUnavailable = /Belum ada nomor terhubung/i.test(nextText);
    const isLoading = /memuat|loading/i.test(nextText);
    if (nextText && !isUnavailable && !isLoading) {
      return nextText;
    }
    await page.waitForTimeout(500);
  }

  return lastText;
}

/**
 * @param {import("@playwright/test").Locator} dialog
 * @param {string[]} placeholders
 * @param {string} value
 */
async function fillByFirstVisiblePlaceholder(dialog, placeholders, value) {
  for (const placeholder of placeholders) {
    const input = dialog.getByPlaceholder(placeholder).first();
    const isVisible = await input.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    await input.fill(value);
    return;
  }

  throw new Error(`Unable to find visible input for placeholders: ${placeholders.join(", ")}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  let skippedReason = "";
  let createdCampaignName = "";

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    await page.goto(`${baseUrl}/shortlinks`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Shortlink System/i }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /Tambah Shortlink/i }).click();
    const createDialog = page.getByRole("dialog", { name: /Tambah Shortlink/i });
    await createDialog.waitFor({ timeout: 10_000 });

    const connectedPhoneLocator = createDialog
      .getByText(/Nomor WhatsApp Terhubung|Nomor Terhubung \(Baileys\)/i)
      .locator("xpath=../p[2]");
    const connectedPhoneText = await waitForConnectedBaileysPhone(connectedPhoneLocator, page, 15_000);
    if (!connectedPhoneText || /Belum ada nomor terhubung/i.test(connectedPhoneText)) {
      skippedReason = "Connected WhatsApp number is unavailable, create flow skipped.";
    } else {
      createdCampaignName = `SMOKE-SHORTLINK-${Date.now()}`;
      await fillByFirstVisiblePlaceholder(createDialog, ["Nama shortlink / campaign", "Contoh: ramadan-sale-2026"], createdCampaignName);
      await fillByFirstVisiblePlaceholder(
        createDialog,
        ["Template pesan (contoh: Halo, saya tertarik promo ini)", "Contoh: Halo, saya tertarik promo ini"],
        "Halo dari smoke test"
      );

      const createButton = createDialog.getByRole("button", {
        name: /Create Shortlink|Creating\.\.\.|Buat Shortlink|Membuat\.\.\./i
      });
      await createButton.click();
      await createDialog.waitFor({ state: "hidden", timeout: 20_000 });

      const createdRow = page.locator("tr", { hasText: createdCampaignName }).first();
      await createdRow.waitFor({ timeout: 20_000 });

      const rowActionsButton = createdRow.getByRole("button", { name: /Open shortlink actions/i }).first();
      await rowActionsButton.click();
      const confirmDeletePromise = page
        .waitForEvent("dialog", { timeout: 3_000 })
        .then(async (dialog) => {
          await dialog.accept();
        })
        .catch(() => {});
      await page.getByRole("menuitem", { name: /^Delete$/i }).click();
      await confirmDeletePromise;

      await createdRow.waitFor({ state: "detached", timeout: 20_000 });
      createdCampaignName = "";
    }
  } finally {
    if (createdCampaignName) {
      try {
        await page.goto(`${baseUrl}/shortlinks`, { waitUntil: "networkidle" });
        const fallbackRow = page.locator("tr", { hasText: createdCampaignName }).first();
        if (await fallbackRow.isVisible().catch(() => false)) {
          await fallbackRow.getByRole("button", { name: /Open shortlink actions/i }).first().click();
          const cleanupConfirmDeletePromise = page
            .waitForEvent("dialog", { timeout: 3_000 })
            .then(async (dialog) => {
              await dialog.accept();
            })
            .catch(() => {});
          await page.getByRole("menuitem", { name: /^Delete$/i }).click();
          await cleanupConfirmDeletePromise;
        }
      } catch {
        // best-effort cleanup only
      }
    }
    await browser.close();
  }

  return {
    failures,
    skippedReason
  };
}

const startedAtMs = Date.now();
try {
  const result = await main();
  if (result.failures.length > 0) {
    console.error("Shortlinks deep smoke checks failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    await writeSmokeReport({
      suite: "smoke-ui-shortlinks-deep",
      startedAtMs,
      status: "failed",
      baseUrl,
      failures: result.failures
    });
    process.exit(1);
  }

  if (result.skippedReason) {
    console.log(`Shortlinks deep smoke checks skipped: ${result.skippedReason}`);
    await writeSmokeReport({
      suite: "smoke-ui-shortlinks-deep",
      startedAtMs,
      status: "skipped",
      baseUrl,
      failures: [],
      skippedReason: result.skippedReason
    });
  } else {
    console.log("Shortlinks deep smoke checks passed.");
    await writeSmokeReport({
      suite: "smoke-ui-shortlinks-deep",
      startedAtMs,
      status: "passed",
      baseUrl,
      failures: []
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeSmokeReport({
    suite: "smoke-ui-shortlinks-deep",
    startedAtMs,
    status: "failed",
    baseUrl,
    failures: [message],
    error: message
  });
  throw error;
}
