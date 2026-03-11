import { buildMockWhatsAppMessageId, isWhatsAppMockModeEnabled } from "@/lib/whatsapp/mockMode";

type WhatsAppSendTextInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
};

type WhatsAppSendTemplateInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  components: Array<Record<string, unknown>>;
};

const RETRY_DELAYS_MS = [1000, 3000, 10000];

function normalize(value: string): string {
  return value.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function postWithRetry(url: string, payload: unknown, accessToken: string): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json().catch(() => null)) as
        | { messages?: Array<{ id?: string }>; error?: { message?: string } }
        | null;

      if (response.ok) {
        return body;
      }

      const message = body?.error?.message ?? `WhatsApp API request failed with status ${response.status}`;
      throw new Error(message);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown WhatsApp API error.");

      if (attempt < RETRY_DELAYS_MS.length - 1) {
        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw lastError ?? new Error("WhatsApp API request failed.");
}

function parseWaMessageId(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const messages = (responseBody as { messages?: Array<{ id?: string }> }).messages;
  const messageId = messages?.[0]?.id;
  return messageId ? normalize(messageId) : null;
}

export async function sendWhatsAppTextMessage(input: WhatsAppSendTextInput): Promise<string | null> {
  if (isWhatsAppMockModeEnabled()) {
    return buildMockWhatsAppMessageId("text");
  }

  const responseBody = await postWithRetry(
    `https://graph.facebook.com/v20.0/${encodeURIComponent(input.phoneNumberId)}/messages`,
    {
      messaging_product: "whatsapp",
      to: normalize(input.to),
      type: "text",
      text: {
        body: input.text
      }
    },
    input.accessToken
  );

  return parseWaMessageId(responseBody);
}

export async function sendWhatsAppTemplateMessage(input: WhatsAppSendTemplateInput): Promise<string | null> {
  if (isWhatsAppMockModeEnabled()) {
    return buildMockWhatsAppMessageId("template");
  }

  const responseBody = await postWithRetry(
    `https://graph.facebook.com/v20.0/${encodeURIComponent(input.phoneNumberId)}/messages`,
    {
      messaging_product: "whatsapp",
      to: normalize(input.to),
      type: "template",
      template: {
        name: normalize(input.templateName),
        language: {
          code: normalize(input.languageCode) || "en"
        },
        components: input.components
      }
    },
    input.accessToken
  );

  return parseWaMessageId(responseBody);
}
