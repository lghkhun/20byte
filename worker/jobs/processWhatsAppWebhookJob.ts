import { processWhatsAppWebhookPayload } from "@/server/services/whatsappWebhookService";

export async function processWhatsAppWebhookJob(jobPayload: unknown): Promise<void> {
  const result = await processWhatsAppWebhookPayload(jobPayload);

  if (result.receivedMessageCount > 0) {
    console.log(
      `[whatsapp-webhook] processed received=${result.receivedMessageCount} accepted=${result.acceptedMessageCount} duplicate=${result.duplicateMessageCount} ignored=${result.ignoredMessageCount}`
    );
  }
}
