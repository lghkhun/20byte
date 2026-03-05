import { processWhatsAppWebhookJob } from "@/server/jobs/processWhatsAppWebhookJob";
import { dequeueWhatsAppWebhookJob } from "@/server/queues/webhookQueue";

let running = false;

const IDLE_TIMEOUT_SECONDS = 5;
const RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function startWhatsAppWebhookProcessor(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  console.log("[worker] whatsapp webhook processor started");

  while (running) {
    try {
      const job = await dequeueWhatsAppWebhookJob(IDLE_TIMEOUT_SECONDS);
      if (!job) {
        continue;
      }

      await processWhatsAppWebhookJob(job.payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] whatsapp webhook processor error: ${message}`);
      await delay(RETRY_DELAY_MS);
    }
  }
}

export function stopWhatsAppWebhookProcessor(): void {
  running = false;
}
