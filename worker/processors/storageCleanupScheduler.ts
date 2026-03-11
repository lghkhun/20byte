import { enqueueStorageCleanupJob } from "@/server/queues/cleanupQueue";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

async function enqueueTick(): Promise<void> {
  try {
    await enqueueStorageCleanupJob();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[worker] storage cleanup scheduler enqueue error: ${message}`);
  }
}

export async function startStorageCleanupScheduler(): Promise<void> {
  if (timer) {
    return;
  }

  await enqueueTick();
  timer = setInterval(() => {
    void enqueueTick();
  }, CLEANUP_INTERVAL_MS);
}

export function stopStorageCleanupScheduler(): void {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
}
