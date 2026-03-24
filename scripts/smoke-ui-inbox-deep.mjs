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
  let originalNoteValue = "";
  let hasWrittenTestNote = false;
  let targetConversationId = "";

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    const conversationsRes = await context.request.get(`${baseUrl}/api/conversations?limit=1`);
    if (!conversationsRes.ok()) {
      throw new Error(`Failed to load conversations (${conversationsRes.status()}).`);
    }
    const conversationsPayload = await conversationsRes.json().catch(() => null);
    const conversationId = conversationsPayload?.data?.conversations?.[0]?.id;
    if (typeof conversationId !== "string" || conversationId.trim().length === 0) {
      throw new Error("No conversation found for inbox deep smoke.");
    }
    targetConversationId = conversationId;

    await page.goto(`${baseUrl}/inbox?conversationId=${encodeURIComponent(conversationId)}`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Enter message...").first().waitFor({ timeout: 20_000 });

    if ((await page.getByText("Tip: use / for quick reply", { exact: false }).count()) > 0) {
      failures.push("Inbox deep: legacy quick-tip text is still visible.");
    }

    const notesTextarea = page.getByPlaceholder("Catatan khusus pelanggan ini... (Tidak terkirim)").first();
    const openCrmPanelIfNeeded = async () => {
      const isNotesVisible = await notesTextarea.isVisible().catch(() => false);
      if (isNotesVisible) {
        return;
      }

      const showCrmButton = page.locator('button[title="Show CRM panel"]').first();
      if ((await showCrmButton.count()) > 0) {
        await showCrmButton.click();
      } else {
        const mobileCrmButton = page.getByRole("button", { name: /^CRM$/i }).first();
        if ((await mobileCrmButton.count()) > 0) {
          await mobileCrmButton.click();
        } else {
          failures.push("Inbox deep: unable to find CRM panel toggle control.");
        }
      }
    };

    await openCrmPanelIfNeeded();
    await notesTextarea.waitFor({ timeout: 15_000 });
    originalNoteValue = await notesTextarea.inputValue();
    if ((await page.getByText("Terhubung langsung ke field Notes pada data customer.", { exact: true }).count()) === 0) {
      failures.push("Inbox deep: notes linkage helper text is missing.");
    }

    const noteValue = `[SMOKE-INBOX ${Date.now()}]`;
    await notesTextarea.fill(noteValue);
    const saveNotesButton = page.getByRole("button", { name: /Simpan Catatan|Saving.../i }).first();
    await saveNotesButton.click();
    await page.getByRole("button", { name: /Simpan Catatan/i }).first().waitFor({ timeout: 15_000 });
    hasWrittenTestNote = true;

    await page.reload({ waitUntil: "networkidle" });
    await page.getByPlaceholder("Enter message...").first().waitFor({ timeout: 20_000 });
    await openCrmPanelIfNeeded();

    const reloadedNotesTextarea = page.getByPlaceholder("Catatan khusus pelanggan ini... (Tidak terkirim)").first();
    await reloadedNotesTextarea.waitFor({ timeout: 15_000 });
    const reloadedValue = await reloadedNotesTextarea.inputValue();
    if (reloadedValue.trim() !== noteValue) {
      failures.push("Inbox deep: notes value is not persisted after save/reload.");
    }

    const mediaTab = page.getByRole("button", { name: /^Media$/i }).first();
    const documentTab = page.getByRole("button", { name: /^Dokumen$/i }).first();
    const linkTab = page.getByRole("button", { name: /^Tautan$/i }).first();
    if ((await mediaTab.count()) === 0 || (await documentTab.count()) === 0 || (await linkTab.count()) === 0) {
      failures.push("Inbox deep: media/document/link tab controls are incomplete.");
    } else {
      await mediaTab.click();
      await documentTab.click();
      await linkTab.click();
    }

    if ((await page.getByRole("button", { name: /^Create Invoice$/i }).count()) === 0) {
      failures.push("Inbox deep: CRM panel 'Create Invoice' button is missing.");
    }
  } finally {
    if (hasWrittenTestNote) {
      try {
        const restoreRoute = targetConversationId
          ? `/inbox?conversationId=${encodeURIComponent(targetConversationId)}`
          : "/inbox";
        await page.goto(`${baseUrl}${restoreRoute}`, { waitUntil: "networkidle" });
        await page.getByPlaceholder("Enter message...").first().waitFor({ timeout: 20_000 });
        const restoreNotesTextarea = page.getByPlaceholder("Catatan khusus pelanggan ini... (Tidak terkirim)").first();
        const restoreVisible = await restoreNotesTextarea.isVisible().catch(() => false);
        if (!restoreVisible) {
          const showCrmButton = page.locator('button[title="Show CRM panel"]').first();
          if ((await showCrmButton.count()) > 0) {
            await showCrmButton.click();
          } else {
            const mobileCrmButton = page.getByRole("button", { name: /^CRM$/i }).first();
            if ((await mobileCrmButton.count()) > 0) {
              await mobileCrmButton.click();
            }
          }
        }
        await restoreNotesTextarea.waitFor({ timeout: 15_000 });
        await restoreNotesTextarea.fill(originalNoteValue);
        await page.getByRole("button", { name: /Simpan Catatan|Saving.../i }).first().click();
        await page.getByRole("button", { name: /Simpan Catatan/i }).first().waitFor({ timeout: 15_000 });
      } catch {
        // best-effort cleanup only
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
    console.error("Inbox deep smoke checks failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    await writeSmokeReport({
      suite: "smoke-ui-inbox-deep",
      startedAtMs,
      status: "failed",
      baseUrl,
      failures: result.failures
    });
    process.exit(1);
  }

  console.log("Inbox deep smoke checks passed.");
  await writeSmokeReport({
    suite: "smoke-ui-inbox-deep",
    startedAtMs,
    status: "passed",
    baseUrl,
    failures: []
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeSmokeReport({
    suite: "smoke-ui-inbox-deep",
    startedAtMs,
    status: "failed",
    baseUrl,
    failures: [message],
    error: message
  });
  throw error;
}
