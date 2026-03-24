#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { writeSmokeReport } from "./smoke-report.mjs";

const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3001";
const email = process.env.SMOKE_EMAIL?.trim() || "";
const password = process.env.SMOKE_PASSWORD?.trim() || "";
const IGNORED_CONSOLE_ERROR_PATTERNS = [/Failed to fetch RSC payload/i, /Falling back to browser navigation/i];

if (!email || !password) {
  console.error("Missing credentials. Set SMOKE_EMAIL and SMOKE_PASSWORD.");
  process.exit(1);
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {string} route
 */
async function gotoRoute(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForLoadState("domcontentloaded");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const nextError = msg.text();
      const isIgnored = IGNORED_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(nextError));
      if (!isIgnored) {
        consoleErrors.push(nextError);
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
    await page.getByRole("heading", { name: /Invoice System/i }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Create Invoice$/i }).click();
    await page.getByRole("dialog", { name: /Create Invoice from Invoices/i }).waitFor({ timeout: 15_000 });
    await page.locator("text=Searching customers...").first().waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const hasCustomerButtons = (await page.getByRole("dialog", { name: /Create Invoice from Invoices/i }).locator("button").filter({ hasText: /existing convo|no convo/i }).count()) > 0;
    const hasEmptyState =
      (await page.getByText("No customer found.", { exact: true }).count()) > 0 ||
      (await page.getByText("No customers found.", { exact: true }).count()) > 0;
    if (!hasCustomerButtons && !hasEmptyState) {
      failures.push("Invoices: customer picker did not render rows or empty state.");
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
    const messageInput = page.getByPlaceholder("Enter message...").first();
    const hasReadyInput = await messageInput.isVisible().catch(() => false);
    if (!hasReadyInput) {
      const firstConversationButton = page.locator('[data-panel="conversation-list"] button').first();
      if ((await firstConversationButton.count()) > 0) {
        await firstConversationButton.click();
      }
      await messageInput.waitFor({ timeout: 20_000 });
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
