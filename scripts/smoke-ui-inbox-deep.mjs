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
 * @param {import("@playwright/test").Locator} textarea
 * @param {import("@playwright/test").Page} page
 * @param {string} expectedValue
 * @param {number} timeoutMs
 */
async function waitForTextareaValue(textarea, page, expectedValue, timeoutMs = 12_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const currentValue = await textarea.inputValue().catch(() => "");
    if (currentValue.trim() === expectedValue) {
      return true;
    }
    await page.waitForTimeout(250);
  }

  return false;
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {number} timeoutMs
 */
async function waitForNotesSaveSettled(page, timeoutMs = 20_000) {
  const startedAt = Date.now();
  const saveButton = page.getByRole("button", { name: /Simpan Catatan|Save Notes|Saving.../i }).first();

  while (Date.now() - startedAt < timeoutMs) {
    const isVisible = await saveButton.isVisible().catch(() => false);
    if (isVisible) {
      const isDisabled = await saveButton.isDisabled().catch(() => false);
      const label = (await saveButton.textContent().catch(() => ""))?.trim() ?? "";
      if (!isDisabled && /Simpan Catatan|Save Notes/i.test(label)) {
        return true;
      }
    }
    const hasSaveError = await page.getByText(/Failed to save notes|Network error while saving notes|gagal|error/i).count();
    if (hasSaveError > 0) {
      return false;
    }
    await page.waitForTimeout(250);
  }

  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const actorContext = await browser.newContext();
  const page = await context.newPage();
  const actorPage = await actorContext.newPage();
  const failures = [];
  let originalNoteValue = "";
  let hasWrittenTestNote = false;
  let targetConversationId = "";
  let hasActorSession = false;
  let realtimeTokenHealthy = false;
  const realtimeTokenRoutePattern = "**/api/realtime/ably/token?*";
  const blockRealtimeTokenRoute = (route) => route.abort();
  const getMessageComposer = () => page.getByPlaceholder(/Enter message\.\.\.|Ketik pesan\.\.\./i).first();
  const ensureComposerReady = async () => {
    const composer = getMessageComposer();
    const visible = await composer.isVisible().catch(() => false);
    if (visible) {
      return composer;
    }

    const firstConversationButton = page.locator('[data-panel="conversation-list"] button').first();
    if ((await firstConversationButton.count()) > 0) {
      await firstConversationButton.click().catch(() => {});
    }
    await composer.waitFor({ timeout: 20_000 });
    return composer;
  };

  try {
    const loginRes = await context.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status()}): ${body}`);
    }

    const conversationsRes = await context.request.get(`${baseUrl}/api/conversations?limit=20`);
    if (!conversationsRes.ok()) {
      throw new Error(`Failed to load conversations (${conversationsRes.status()}).`);
    }
    const conversationsPayload = await conversationsRes.json().catch(() => null);
    const conversations = Array.isArray(conversationsPayload?.data?.conversations) ? conversationsPayload.data.conversations : [];
    const preferredConversation =
      conversations.find((conversation) => typeof conversation?.customerId === "string" && conversation.customerId.trim().length > 0) ??
      conversations[0];
    const conversationId = preferredConversation?.id;
    const canValidateNotes = typeof preferredConversation?.customerId === "string" && preferredConversation.customerId.trim().length > 0;
    if (typeof conversationId !== "string" || conversationId.trim().length === 0) {
      throw new Error("No conversation found for inbox deep smoke.");
    }
    targetConversationId = conversationId;
    const orgRes = await context.request.get(`${baseUrl}/api/orgs`);
    if (!orgRes.ok()) {
      throw new Error(`Failed to load organizations (${orgRes.status()}).`);
    }
    const orgPayload = await orgRes.json().catch(() => null);
    const orgId = orgPayload?.data?.organizations?.[0]?.id;
    if (typeof orgId === "string" && orgId.trim().length > 0) {
      const realtimeTokenRes = await context.request.get(
        `${baseUrl}/api/realtime/ably/token?orgId=${encodeURIComponent(orgId)}`
      );
      realtimeTokenHealthy = realtimeTokenRes.ok();
    }

    const actorLoginRes = await actorContext.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password }
    });
    if (actorLoginRes.ok()) {
      hasActorSession = true;
    } else {
      failures.push("Inbox deep: secondary actor session login failed.");
    }

    await page.goto(`${baseUrl}/inbox?conversationId=${encodeURIComponent(conversationId)}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await ensureComposerReady();

    if ((await page.getByText("Tip: use / for quick reply", { exact: false }).count()) > 0) {
      failures.push("Inbox deep: legacy quick-tip text is still visible.");
    }

    const notesTextarea = page.getByPlaceholder("Catatan khusus pelanggan ini... (Tidak terkirim)").first();
    const openCrmPanelIfNeeded = async () => {
      const isNotesVisible = await notesTextarea.waitFor({ timeout: 4_000 }).then(() => true).catch(() => false);
      if (isNotesVisible) {
        return true;
      }

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const hideCrmButton = page
          .locator('button[title*="Hide CRM panel"], button[title*="hide crm panel"], button[title*="Sembunyikan CRM panel"]')
          .first();
        if ((await hideCrmButton.count()) > 0) {
          const visibleWhileOpen = await notesTextarea.waitFor({ timeout: 2_500 }).then(() => true).catch(() => false);
          if (visibleWhileOpen) {
            return true;
          }
        }

        const showCrmButton = page
          .locator('button[title*="Show CRM panel"], button[title*="show crm panel"], button[title*="Tampilkan CRM panel"]')
          .first();
        if ((await showCrmButton.count()) > 0) {
          const isDisabled = await showCrmButton.isDisabled().catch(() => false);
          if (!isDisabled) {
            await showCrmButton.click().catch(() => {});
          }
        } else {
          const mobileCrmButton = page.getByRole("button", { name: /^CRM$/i }).first();
          if ((await mobileCrmButton.count()) > 0) {
            await mobileCrmButton.click().catch(() => {});
          } else {
            await page.keyboard.press("Control+Shift+B").catch(() => {});
          }
        }

        const becameVisible = await notesTextarea.isVisible().catch(() => false);
        if (becameVisible) {
          return true;
        }
        await page.waitForTimeout(500);
      }

      const notesNowVisible = await notesTextarea.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      if (!notesNowVisible) {
        failures.push("Inbox deep: unable to find CRM panel toggle control.");
      }
      return notesNowVisible;
    };

    const crmPanelAvailable = await openCrmPanelIfNeeded();
    if (crmPanelAvailable && canValidateNotes) {
      await page.getByText("Loading lead settings...", { exact: false }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
      originalNoteValue = await notesTextarea.inputValue();
      if ((await page.getByText("Terhubung langsung ke field Notes pada data customer.", { exact: true }).count()) === 0) {
        failures.push("Inbox deep: notes linkage helper text is missing.");
      }

      const noteValue = `[SMOKE-INBOX ${Date.now()}]`;
      await notesTextarea.fill(noteValue);
      const saveNotesButton = page.getByRole("button", { name: /Simpan Catatan|Saving.../i }).first();
      await saveNotesButton.click();
      const noteSaveSettled = await waitForNotesSaveSettled(page, 20_000);
      if (!noteSaveSettled) {
        failures.push("Inbox deep: notes save request did not settle.");
      } else {
        hasWrittenTestNote = true;
      }

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await ensureComposerReady();
      const crmPanelVisibleAfterReload = await openCrmPanelIfNeeded();

      if (crmPanelVisibleAfterReload) {
        await page.getByText("Loading lead settings...", { exact: false }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
        const reloadedNotesTextarea = page.getByPlaceholder("Catatan khusus pelanggan ini... (Tidak terkirim)").first();
        const notePersisted = await waitForTextareaValue(reloadedNotesTextarea, page, noteValue, 30_000);
        if (!notePersisted) {
          failures.push("Inbox deep: notes value is not persisted after save/reload.");
        }
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
    } else if (!canValidateNotes) {
      console.log("Inbox deep smoke checks: note persistence check skipped (no conversation with linked customer in seed data).");
    }

    await page.route(realtimeTokenRoutePattern, blockRealtimeTokenRoute);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await ensureComposerReady();
    const fallbackBanner = page.getByText("Realtime terputus, saat ini memakai fallback polling.", { exact: true }).first();
    await fallbackBanner.waitFor({ timeout: 15_000 }).catch(() => {
      failures.push("Inbox deep: realtime fallback banner did not appear when token route is blocked.");
    });
    await page.unroute(realtimeTokenRoutePattern, blockRealtimeTokenRoute);

    if (realtimeTokenHealthy) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await ensureComposerReady();
      await page.waitForTimeout(1_200);
      const fallbackStillVisible = await page
        .getByText("Realtime terputus, saat ini memakai fallback polling.", { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      if (fallbackStillVisible) {
        failures.push("Inbox deep: realtime fallback banner is still visible after token route recovery.");
      }
    }

    if (hasActorSession) {
      const marker = `[SMOKE-RT-${Date.now()}]`;
      const sendRes = await actorContext.request.post(`${baseUrl}/api/inbox/send`, {
        data: {
          conversationId,
          type: "SYSTEM",
          text: marker
        }
      });

      if (!sendRes.ok()) {
        const body = await sendRes.text();
        failures.push(`Inbox deep: actor session failed to send system message (${sendRes.status()}): ${body}`);
      } else {
        const newBubble = page.locator("article").filter({ hasText: marker }).first();
        await newBubble.waitFor({ timeout: 20_000 }).catch(() => {
          failures.push("Inbox deep: new message from actor session did not appear realtime without manual refresh.");
        });
        const hasSentStatus = await newBubble.getByText("SENT", { exact: true }).first().isVisible().catch(() => false);
        if (!hasSentStatus) {
          failures.push("Inbox deep: new realtime message does not show outbound SENT status badge.");
        }
      }
    }
  } finally {
    await page.unroute(realtimeTokenRoutePattern, blockRealtimeTokenRoute).catch(() => {});
    if (hasWrittenTestNote) {
      try {
        const restoreRoute = targetConversationId
          ? `/inbox?conversationId=${encodeURIComponent(targetConversationId)}`
          : "/inbox";
        await page.goto(`${baseUrl}${restoreRoute}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
        await ensureComposerReady();
        const restoreNotesTextarea = page.getByPlaceholder("Catatan khusus pelanggan ini... (Tidak terkirim)").first();
        const restoreVisible = await restoreNotesTextarea.isVisible().catch(() => false);
        if (!restoreVisible) {
          const showCrmButton = page.locator('button[title*="CRM panel"]').first();
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
        await page.getByText("Loading lead settings...", { exact: false }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
        await restoreNotesTextarea.fill(originalNoteValue);
        await page.getByRole("button", { name: /Simpan Catatan|Saving.../i }).first().click();
        await waitForNotesSaveSettled(page, 20_000);
      } catch {
        // best-effort cleanup only
      }
    }
    await actorPage.close().catch(() => {});
    await actorContext.close().catch(() => {});
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
