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
 * @param {import("@playwright/test").Locator} dialog
 * @param {import("@playwright/test").Page} page
 */
async function waitForInvoiceCustomerPickerState(dialog, page) {
  const timeoutMs = 20_000;
  const startedAt = Date.now();
  let last = { hasRows: false, hasEmptyState: false, hasFetchError: false, isLoading: true };

  while (Date.now() - startedAt < timeoutMs) {
    const hasStatusRows =
      (await dialog.locator("button").filter({ hasText: /existing convo|no convo|sudah ada chat|belum ada chat/i }).count()) > 0;
    const hasGenericRows = (await dialog.locator(".divide-y button").count()) > 0;
    const hasRows = hasStatusRows || hasGenericRows;
    const hasEmptyState = (await dialog.getByText(/No customer found\.?|No customers found\.?|Pelanggan tidak ditemukan\.?/i).count()) > 0;
    const hasFetchError = (await dialog.getByRole("button", { name: /Coba Lagi|Retry/i }).count()) > 0;
    const isLoading =
      (await dialog.locator("text=Searching customers..., text=Mencari pelanggan...").count()) > 0 ||
      (await dialog.locator(".animate-pulse").count()) > 0;
    last = { hasRows, hasEmptyState, hasFetchError, isLoading };

    if (hasRows || hasEmptyState || hasFetchError) {
      return last;
    }
    await page.waitForTimeout(250);
  }

  return last;
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

    await page.goto(`${baseUrl}/invoices`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.getByRole("heading", { name: /Invoice System|Manajemen Invoice/i }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: /^Create Invoice$|^Buat Invoice$/i }).first().click();
    const createDialog = page.getByRole("dialog", { name: /Create Invoice from Invoices|Buat Invoice dari Halaman Invoice/i });
    await createDialog.waitFor({ timeout: 10_000 });

    const pickerState = await waitForInvoiceCustomerPickerState(createDialog, page);
    if (!pickerState.hasRows) {
      if (pickerState.hasFetchError) {
        failures.push("Invoices deep: customer picker returned fetch error.");
      } else if (pickerState.hasEmptyState) {
        console.log("Invoices deep smoke checks skipped: no customer available in picker.");
      } else if (pickerState.isLoading) {
        failures.push("Invoices deep: customer picker kept loading beyond timeout.");
      } else {
        failures.push("Invoices deep: customer picker has no selectable customer.");
      }
    } else {
      const firstCustomerButton = createDialog
        .locator(".divide-y button")
        .first();
      const hasCustomerButton = (await firstCustomerButton.count()) > 0;
      if (!hasCustomerButton) {
        failures.push("Invoices deep: customer picker rendered rows but no selectable button.");
        return { failures };
      }
      await firstCustomerButton.click();
      const continueButton = createDialog.getByRole("button", { name: /^(Continue|Lanjutkan|Menyiapkan\.\.\.)$/i });
      await continueButton.click();

      const saveInvoiceButton = page.getByRole("button", { name: /Simpan Invoice|Menyimpan.../i }).first();
      await saveInvoiceButton.waitFor({ timeout: 20_000 });

      const cancelButtons = page.getByRole("button", { name: /^Batalkan$|^Batal$/i });
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
