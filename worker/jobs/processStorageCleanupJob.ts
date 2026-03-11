import { runChatRetentionCleanup, runInvoiceRetentionCleanup } from "@/server/services/storageService";

export async function processStorageCleanupJob(): Promise<void> {
  const [chatResult, invoiceResult] = await Promise.all([runChatRetentionCleanup(), runInvoiceRetentionCleanup()]);

  if (chatResult.totalCleaned > 0 || invoiceResult.totalCleanedInvoices > 0 || invoiceResult.totalCleanedProofs > 0) {
    console.log(
      `[worker] storage cleanup: chat(scanned=${chatResult.totalScanned}, cleaned=${chatResult.totalCleaned}, bytes=${chatResult.totalCleanedBytes}) invoice(scanned=${invoiceResult.totalScanned}, cleanedInvoices=${invoiceResult.totalCleanedInvoices}, cleanedProofs=${invoiceResult.totalCleanedProofs}, bytes=${invoiceResult.totalCleanedBytes})`
    );
  }
}
