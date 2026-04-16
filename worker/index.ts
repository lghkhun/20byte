import { startMetaEventProcessor, stopMetaEventProcessor } from "@/worker/processors/metaEventProcessor";
import { startStorageCleanupProcessor, stopStorageCleanupProcessor } from "@/worker/processors/storageCleanupProcessor";
import { startStorageCleanupScheduler, stopStorageCleanupScheduler } from "@/worker/processors/storageCleanupScheduler";
import {
  startWhatsAppPublicScheduleProcessor,
  stopWhatsAppPublicScheduleProcessor
} from "@/worker/processors/whatsappPublicScheduleProcessor";
import {
  startWhatsAppPublicWebhookProcessor,
  stopWhatsAppPublicWebhookProcessor
} from "@/worker/processors/whatsappPublicWebhookProcessor";

export async function startWorker(): Promise<void> {
  await Promise.all([
    startMetaEventProcessor(),
    startStorageCleanupProcessor(),
    startStorageCleanupScheduler(),
    startWhatsAppPublicScheduleProcessor(),
    startWhatsAppPublicWebhookProcessor()
  ]);
}

export function stopWorker(): void {
  stopMetaEventProcessor();
  stopStorageCleanupProcessor();
  stopStorageCleanupScheduler();
  stopWhatsAppPublicScheduleProcessor();
  stopWhatsAppPublicWebhookProcessor();
}
