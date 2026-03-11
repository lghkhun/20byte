import { withRetry } from "@/lib/retry/withRetry";
import { sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/server/services/whatsappApiService";

export async function sendOutboundTextWithRetry(params: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}): Promise<string | null> {
  return withRetry(
    "outbound-text-send",
    () =>
      sendWhatsAppTextMessage({
        accessToken: params.accessToken,
        phoneNumberId: params.phoneNumberId,
        to: params.to,
        text: params.text
      }),
    { retries: 2, baseDelayMs: 1500, factor: 2, jitter: true }
  );
}

export async function sendOutboundTemplateWithRetry(params: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  components: Array<Record<string, unknown>>;
}): Promise<string | null> {
  return withRetry(
    "outbound-template-send",
    () =>
      sendWhatsAppTemplateMessage({
        accessToken: params.accessToken,
        phoneNumberId: params.phoneNumberId,
        to: params.to,
        templateName: params.templateName,
        languageCode: params.languageCode,
        components: params.components
      }),
    { retries: 2, baseDelayMs: 1500, factor: 2, jitter: true }
  );
}
