import { startMetaEventProcessor, stopMetaEventProcessor } from "@/worker/processors/metaEventProcessor";
import { startStorageCleanupProcessor, stopStorageCleanupProcessor } from "@/worker/processors/storageCleanupProcessor";
import { startStorageCleanupScheduler, stopStorageCleanupScheduler } from "@/worker/processors/storageCleanupScheduler";

export async function startWorker(): Promise<void> {
  await Promise.all([
    startMetaEventProcessor(),
    startStorageCleanupProcessor(),
    startStorageCleanupScheduler()
  ]);
}

export function stopWorker(): void {
  stopMetaEventProcessor();
  stopStorageCleanupProcessor();
  stopStorageCleanupScheduler();
}
