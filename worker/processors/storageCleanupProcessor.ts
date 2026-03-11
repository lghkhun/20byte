import { processStorageCleanupJob } from "@/worker/jobs/processStorageCleanupJob";
import { dequeueStorageCleanupJob } from "@/server/queues/cleanupQueue";
import { withRetry } from "@/lib/retry/withRetry";

let active = false;

const IDLE_TIMEOUT_SECONDS = 5;

export async function startStorageCleanupProcessor(): Promise<void> {
  if (active) {
    return;
  }
  active = true;

  console.log("[worker] storage cleanup processor started");

  while (active) {
    try {
      const job = await withRetry("storage-cleanup-dequeue", () => dequeueStorageCleanupJob(IDLE_TIMEOUT_SECONDS), {
        retries: 2,
        baseDelayMs: 300,
        factor: 2,
        jitter: true
      });

      if (!job) {
        continue;
      }

      await withRetry("storage-cleanup-process", () => processStorageCleanupJob(), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        jitter: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] storage cleanup processor error: ${message}`);
    }
  }
}

export function stopStorageCleanupProcessor(): void {
  active = false;
}
