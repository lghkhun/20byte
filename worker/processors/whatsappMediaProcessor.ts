import { processWhatsAppMediaJob } from "@/worker/jobs/processWhatsAppMediaJob";
import { dequeueWhatsAppMediaDownloadJob } from "@/server/queues/mediaQueue";
import { withRetry } from "@/lib/retry/withRetry";

let running = false;

const IDLE_TIMEOUT_SECONDS = 5;
export async function startWhatsAppMediaProcessor(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  console.log("[worker] whatsapp media processor started");

  while (running) {
    try {
      const job = await withRetry(
        "whatsapp-media-dequeue",
        () => dequeueWhatsAppMediaDownloadJob(IDLE_TIMEOUT_SECONDS),
        { retries: 3, baseDelayMs: 500, factor: 2, jitter: true }
      );
      if (!job) {
        continue;
      }

      await withRetry("whatsapp-media-process", () => processWhatsAppMediaJob(job.payload), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        jitter: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] whatsapp media processor error: ${message}`);
    }
  }
}

export function stopWhatsAppMediaProcessor(): void {
  running = false;
}
