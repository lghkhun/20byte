import { startStorageCleanupProcessor, stopStorageCleanupProcessor } from "@/worker/processors/storageCleanupProcessor";
import { startStorageCleanupScheduler, stopStorageCleanupScheduler } from "@/worker/processors/storageCleanupScheduler";

export async function startWorker(): Promise<void> {
  await Promise.all([
    startStorageCleanupProcessor(),
    startStorageCleanupScheduler()
  ]);
}

export function stopWorker(): void {
  stopStorageCleanupProcessor();
  stopStorageCleanupScheduler();
}
