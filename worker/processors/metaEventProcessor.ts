import { withRetry } from "@/lib/retry/withRetry";
import { dequeueMetaEventJob, requeueMetaEventJob } from "@/server/queues/metaEventQueue";
import { MetaEventProcessingError, processMetaEventJob } from "@/server/services/metaEventService";

let active = false;

const IDLE_TIMEOUT_SECONDS = 5;

export async function startMetaEventProcessor(): Promise<void> {
  if (active) {
    return;
  }
  active = true;

  console.log("[worker] meta event processor started");

  while (active) {
    try {
      const job = await withRetry("meta-event-dequeue", () => dequeueMetaEventJob(IDLE_TIMEOUT_SECONDS), {
        retries: 2,
        baseDelayMs: 300,
        factor: 2,
        jitter: true
      });

      if (!job) {
        continue;
      }

      try {
        await withRetry("meta-event-process", () => processMetaEventJob(job.payload), {
          retries: 3,
          baseDelayMs: 1000,
          factor: 2,
          jitter: true
        });
      } catch (processError) {
        const retryable = !(processError instanceof MetaEventProcessingError) || processError.retryable;
        if (retryable) {
          await requeueMetaEventJob(job);
        }
        throw processError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[worker] meta event processor error: ${message}`);
    }
  }
}

export function stopMetaEventProcessor(): void {
  active = false;
}
