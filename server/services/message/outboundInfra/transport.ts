import { withRetry } from "@/lib/retry/withRetry";
import { sendBaileysMediaMessage, sendBaileysTemplateLikeMessage, sendBaileysTextMessage } from "@/server/services/baileysService";

export async function sendOutboundTextWithRetry(params: {
  orgId: string;
  to: string;
  text: string;
}): Promise<string | null> {
  return withRetry(
    "outbound-text-send",
    () =>
      sendBaileysTextMessage({
        orgId: params.orgId,
        toPhoneE164: params.to,
        text: params.text
      }),
    { retries: 2, baseDelayMs: 600, factor: 2, jitter: true }
  );
}

export async function sendOutboundTemplateWithRetry(params: {
  orgId: string;
  to: string;
  templateName: string;
  languageCode: string;
  components: Array<Record<string, unknown>>;
}): Promise<string | null> {
  return withRetry(
    "outbound-template-send",
    () =>
      sendBaileysTemplateLikeMessage({
        orgId: params.orgId,
        toPhoneE164: params.to,
        templateName: params.templateName,
        languageCode: params.languageCode,
        components: params.components
      }),
    { retries: 2, baseDelayMs: 600, factor: 2, jitter: true }
  );
}

export async function sendOutboundMediaWithRetry(params: {
  orgId: string;
  to: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  fileName: string;
  mimeType?: string;
  caption?: string;
  buffer: Buffer;
}): Promise<string | null> {
  return withRetry(
    "outbound-media-send",
    () =>
      sendBaileysMediaMessage({
        orgId: params.orgId,
        toPhoneE164: params.to,
        type: params.type,
        fileName: params.fileName,
        mimeType: params.mimeType,
        caption: params.caption,
        buffer: params.buffer
      }),
    { retries: 2, baseDelayMs: 600, factor: 2, jitter: true }
  );
}
