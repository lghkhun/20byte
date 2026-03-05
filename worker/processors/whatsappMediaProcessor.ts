import { processWhatsAppMediaJob } from "@/server/jobs/processWhatsAppMediaJob";
import { dequeueWhatsAppMediaDownloadJob } from "@/server/queues/mediaQueue";

let running = false;

const IDLE_TIMEOUT_SECONDS = 5;
const RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function startWhatsAppMediaProcessor(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  console.log("[worker] whatsapp media processor started");

  while (running) {
    try {
      const job = await dequeueWhatsAppMediaDownloadJob(IDLE_TIMEOUT_SECONDS);
      if (!job) {
        continue;
      }

      await processWhatsAppMediaJob(job.payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] whatsapp media processor error: ${message}`);
      await delay(RETRY_DELAY_MS);
    }
  }
}

export function stopWhatsAppMediaProcessor(): void {
  running = false;
}

