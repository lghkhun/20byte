import { startWhatsAppMediaProcessor, stopWhatsAppMediaProcessor } from "@/worker/processors/whatsappMediaProcessor";
import { startWhatsAppWebhookProcessor, stopWhatsAppWebhookProcessor } from "@/worker/processors/whatsappWebhookProcessor";

export async function startWorker(): Promise<void> {
  await Promise.all([startWhatsAppWebhookProcessor(), startWhatsAppMediaProcessor()]);
}

export function stopWorker(): void {
  stopWhatsAppWebhookProcessor();
  stopWhatsAppMediaProcessor();
}
