import { processWhatsAppWebhookJob } from "@/worker/jobs/processWhatsAppWebhookJob";
import { dequeueWhatsAppWebhookJob } from "@/server/queues/webhookQueue";
import { withRetry } from "@/lib/retry/withRetry";

let running = false;

const IDLE_TIMEOUT_SECONDS = 5;
export async function startWhatsAppWebhookProcessor(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  console.log("[worker] whatsapp webhook processor started");

  while (running) {
    try {
      const job = await withRetry(
        "whatsapp-webhook-dequeue",
        () => dequeueWhatsAppWebhookJob(IDLE_TIMEOUT_SECONDS),
        { retries: 3, baseDelayMs: 500, factor: 2, jitter: true }
      );
      if (!job) {
        continue;
      }

      await withRetry("whatsapp-webhook-process", () => processWhatsAppWebhookJob(job.payload), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        jitter: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] whatsapp webhook processor error: ${message}`);
    }
  }
}

export function stopWhatsAppWebhookProcessor(): void {
  running = false;
}
