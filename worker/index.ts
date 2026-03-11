import { startWhatsAppMediaProcessor, stopWhatsAppMediaProcessor } from "@/worker/processors/whatsappMediaProcessor";
import { startWhatsAppWebhookProcessor, stopWhatsAppWebhookProcessor } from "@/worker/processors/whatsappWebhookProcessor";
import { startStorageCleanupProcessor, stopStorageCleanupProcessor } from "@/worker/processors/storageCleanupProcessor";
import { startStorageCleanupScheduler, stopStorageCleanupScheduler } from "@/worker/processors/storageCleanupScheduler";

export async function startWorker(): Promise<void> {
  await Promise.all([
    startWhatsAppWebhookProcessor(),
    startWhatsAppMediaProcessor(),
    startStorageCleanupProcessor(),
    startStorageCleanupScheduler()
  ]);
}

export function stopWorker(): void {
  stopWhatsAppWebhookProcessor();
  stopWhatsAppMediaProcessor();
  stopStorageCleanupProcessor();
  stopStorageCleanupScheduler();
}
