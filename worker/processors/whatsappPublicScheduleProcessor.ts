import { dequeueWhatsAppPublicScheduleJob, requeueWhatsAppPublicScheduleJob } from "@/server/queues/whatsappPublicScheduleQueue";
import { processPublicScheduleJob } from "@/server/services/whatsappPublicApiService";

const IDLE_TIMEOUT_SECONDS = 5;
let running = false;

export async function startWhatsAppPublicScheduleProcessor(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  console.log("[worker] whatsapp public schedule processor started");

  while (running) {
    try {
      const job = await dequeueWhatsAppPublicScheduleJob(IDLE_TIMEOUT_SECONDS);
      if (!job) {
        continue;
      }

      const dueAt = new Date(job.dueAt).getTime();
      if (Number.isFinite(dueAt) && dueAt > Date.now()) {
        await requeueWhatsAppPublicScheduleJob(job);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      await processPublicScheduleJob({
        scheduleId: job.scheduleId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] whatsapp public schedule processor error: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export function stopWhatsAppPublicScheduleProcessor(): void {
  running = false;
}
