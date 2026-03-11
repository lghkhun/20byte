export type StorageUsageSummary = {
  orgId: string;
  quotaBytes: number;
  usedBytes: number;
  usagePercent: number;
  usageByCategory: {
    chatMediaBytes: number;
    paymentProofBytes: number;
  };
};

export type ChatRetentionCleanupResult = {
  orgId: string;
  retentionDays: number;
  scannedCount: number;
  cleanedCount: number;
  cleanedBytes: number;
};

export type InvoiceRetentionCleanupResult = {
  orgId: string;
  retentionDays: number;
  scannedCount: number;
  cleanedInvoiceCount: number;
  cleanedProofCount: number;
  cleanedBytes: number;
};
