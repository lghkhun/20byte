#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { writeSmokeReport } from "./smoke-report.mjs";

const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3001";
const email = process.env.SMOKE_EMAIL?.trim() || "";
const password = process.env.SMOKE_PASSWORD?.trim() || "";
const IGNORED_CONSOLE_ERROR_PATTERNS = [
  /Failed to fetch RSC payload/i,
  /Falling back to browser navigation/i,
  /pps\.whatsapp\.net/i,
  /Access-Control-Allow-Origin.*credentials mode is 'include'/i
];

if (!email || !password) {
  console.error("Missing credentials. Set SMOKE_EMAIL and SMOKE_PASSWORD.");
  process.exit(1);
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {string} route
 */
async function gotoRoute(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
}

/**
 * @param {import("@playwright/test").Locator} dialog
 * @param {import("@playwright/test").Page} page
 */
async function waitForCustomerPickerState(dialog, page) {
  const timeoutMs = 20_000;
  const startMs = Date.now();
  let lastState = { hasRows: false, hasEmptyState: false, hasFetchError: false, isLoading: true };

  while (Date.now() - startMs < timeoutMs) {
    const hasStatusRows =
      (await dialog.locator("button").filter({ hasText: /existing convo|no convo|sudah ada chat|belum ada chat/i }).count()) > 0;
    const hasGenericRows = (await dialog.locator(".divide-y button").count()) > 0;
    const hasRows = hasStatusRows || hasGenericRows;
    const hasEmptyState = (await dialog.getByText(/No customer found\.?|No customers found\.?|Pelanggan tidak ditemukan\.?/i).count()) > 0;
    const hasFetchError = (await dialog.getByRole("button", { name: /Coba Lagi|Retry/i }).count()) > 0;
    const isLoading =
      (await dialog.locator("text=Searching customers..., text=Mencari pelanggan...").count()) > 0 ||
      (await dialog.locator(".animate-pulse").count()) > 0;
    lastState = { hasRows, hasEmptyState, hasFetchError, isLoading };

    if (hasRows || hasEmptyState || hasFetchError) {
      return lastState;
    }

    await page.waitForTimeout(250);
  }

  return lastState;
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {number} timeoutMs
 */
async function ensureInboxComposerReady(page, timeoutMs = 30_000) {
  const startedAt = Date.now();
  const messageInput = page.getByPlaceholder(/Enter message\.\.\.|Ketik pesan\.\.\./i).first();

  while (Date.now() - startedAt < timeoutMs) {
    const hasReadyInput = await messageInput.isVisible().catch(() => false);
    if (hasReadyInput) {
      return true;
    }

    const firstConversationButton = page.locator('[data-panel="conversation-list"] button').first();
    if ((await firstConversationButton.count()) > 0) {
      await firstConversationButton.click().catch(() => {});
    }
    await page.waitForTimeout(750);
  }

  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  const consoleErrors = [];
  const appOrigin = new URL(baseUrl).origin;

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const nextError = msg.text();
      const locationUrl = msg.location()?.url?.trim() ?? "";
      const decoratedError = locationUrl ? `${nextError} @ ${locationUrl}` : nextError;
      const isIgnored = IGNORED_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(nextError));
      const isExternalResourceFailure =
        /Failed to load resource|net::ERR_FAILED/i.test(nextError) && Boolean(locationUrl) && !locationUrl.startsWith(appOrigin);
      const isKnownRealtimeNoise =
        /\[realtime\] crm pipeline subscription failed/i.test(nextError) ||
        /\[realtime\].*subscription failed: Connection closed/i.test(nextError);
      if (!isIgnored) {
        if (isExternalResourceFailure || isKnownRealtimeNoise) {
          return;
        }
        consoleErrors.push(decoratedError);
      }
    }
  });

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    await gotoRoute(page, "/customers");
    await page.getByRole("heading", { name: /Customer Management/i }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /Table Layout/i }).click();
    if ((await page.getByText("Progress Tag", { exact: true }).count()) > 0) {
      failures.push("Customers: 'Progress Tag' column is still present in table layout.");
    }
    if ((await page.getByRole("button", { name: /^save$/i }).count()) === 0) {
      failures.push("Customers: table layout is missing 'Save' button.");
    }
    await page.keyboard.press("Escape");

    await gotoRoute(page, "/invoices");
    await page.getByRole("heading", { name: /Invoice System|Manajemen Invoice/i }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Create Invoice$|^Buat Invoice$/i }).first().click();
    const createInvoiceDialog = page.getByRole("dialog", { name: /Create Invoice from Invoices|Buat Invoice dari Halaman Invoice/i });
    await createInvoiceDialog.waitFor({ timeout: 15_000 });
    const pickerState = await waitForCustomerPickerState(createInvoiceDialog, page);
    if (pickerState.hasFetchError) {
      failures.push("Invoices: customer picker returned fetch error.");
    } else if (!pickerState.hasRows && !pickerState.hasEmptyState) {
      if (pickerState.isLoading) {
        failures.push("Invoices: customer picker kept loading beyond timeout.");
      } else {
        failures.push("Invoices: customer picker did not render rows or empty state.");
      }
    }
    await page.keyboard.press("Escape");

    await gotoRoute(page, "/shortlinks");
    if ((await page.getByRole("heading", { name: /Shortlink/i }).count()) === 0) {
      failures.push("Shortlinks: heading not visible.");
    }

    await gotoRoute(page, "/crm/pipelines");
    if ((await page.getByRole("heading", { name: /CRM Pipeline/i }).count()) === 0) {
      failures.push("CRM Pipeline: heading not visible.");
    }

    let inboxRoute = "/inbox";
    const conversationsRes = await context.request.get(`${baseUrl}/api/conversations?limit=1`);
    if (conversationsRes.ok()) {
      const payload = await conversationsRes.json().catch(() => null);
      const firstConversationId = payload?.data?.conversations?.[0]?.id;
      if (typeof firstConversationId === "string" && firstConversationId.trim().length > 0) {
        inboxRoute = `/inbox?conversationId=${encodeURIComponent(firstConversationId)}`;
      }
    }

    await gotoRoute(page, inboxRoute);
    const composerReady = await ensureInboxComposerReady(page, 30_000);
    if (!composerReady) {
      failures.push("Inbox: message composer did not become ready within timeout.");
    }

    const orgRes = await context.request.get(`${baseUrl}/api/orgs`);
    if (!orgRes.ok()) {
      failures.push(`Inbox: failed to load orgs for realtime health check (${orgRes.status()}).`);
    } else {
      const orgPayload = await orgRes.json().catch(() => null);
      const orgId = orgPayload?.data?.organizations?.[0]?.id;
      if (typeof orgId === "string" && orgId.trim().length > 0) {
        const tokenRes = await context.request.get(`${baseUrl}/api/realtime/ably/token?orgId=${encodeURIComponent(orgId)}`);
        if (!tokenRes.ok()) {
          failures.push(`Inbox: realtime token endpoint failed (${tokenRes.status()}).`);
        } else {
          await page.waitForTimeout(1_000);
          const fallbackVisible = await page
            .getByText("Realtime terputus, saat ini memakai fallback polling.", { exact: true })
            .first()
            .isVisible()
            .catch(() => false);
          if (fallbackVisible) {
            failures.push("Inbox: realtime fallback banner is visible while token endpoint is healthy.");
          }
        }
      }
    }

    const crmPanelToggle = page.getByRole("button", { name: /CRM panel/i }).first();
    const crmTextButton = page.getByRole("button", { name: /^CRM$/i }).first();
    const hasCrmPanelToggle = (await crmPanelToggle.count()) > 0;
    const hasCrmTextButton = (await crmTextButton.count()) > 0;
    if (!hasCrmPanelToggle && !hasCrmTextButton) {
      failures.push("Inbox: CRM control button is not visible.");
    }
    if ((await page.getByText("Tip: use / for quick reply", { exact: false }).count()) > 0) {
      failures.push("Inbox: legacy quick-tip text is still visible.");
    }
  } finally {
    await browser.close();
  }

  if (consoleErrors.length > 0) {
    failures.push(`Console errors detected: ${consoleErrors.slice(0, 3).join(" | ")}`);
  }

  return {
    failures,
    meta: {
      consoleErrorCount: consoleErrors.length
    }
  };
}

const startedAtMs = Date.now();
try {
  const result = await main();
  if (result.failures.length > 0) {
    console.error("Smoke UI checks failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    await writeSmokeReport({
      suite: "smoke-ui",
      startedAtMs,
      status: "failed",
      baseUrl,
      failures: result.failures,
      meta: result.meta
    });
    process.exit(1);
  }

  console.log("Smoke UI checks passed.");
  await writeSmokeReport({
    suite: "smoke-ui",
    startedAtMs,
    status: "passed",
    baseUrl,
    failures: [],
    meta: result.meta
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeSmokeReport({
    suite: "smoke-ui",
    startedAtMs,
    status: "failed",
    baseUrl,
    failures: [message],
    error: message
  });
  throw error;
}
