import { dequeueWhatsAppPublicWebhookEventJob, requeueWhatsAppPublicWebhookEventJob } from "@/server/queues/whatsappPublicWebhookQueue";
import { processPublicWebhookEventDelivery } from "@/server/services/whatsappPublicApiService";

const IDLE_TIMEOUT_SECONDS = 5;
let running = false;

export async function startWhatsAppPublicWebhookProcessor(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  console.log("[worker] whatsapp public webhook processor started");

  while (running) {
    try {
      const job = await dequeueWhatsAppPublicWebhookEventJob(IDLE_TIMEOUT_SECONDS);
      if (!job) {
        continue;
      }

      const dueAt = new Date(job.dueAt).getTime();
      if (Number.isFinite(dueAt) && dueAt > Date.now()) {
        await requeueWhatsAppPublicWebhookEventJob(job);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      await processPublicWebhookEventDelivery({
        eventId: job.eventId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] whatsapp public webhook processor error: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export function stopWhatsAppPublicWebhookProcessor(): void {
  running = false;
}
