-- 1) Invoice number uniqueness must be per organization, not global.
ALTER TABLE `Invoice`
  DROP INDEX `Invoice_invoiceNo_key`;

ALTER TABLE `Invoice`
  ADD UNIQUE INDEX `Invoice_orgId_invoiceNo_key`(`orgId`, `invoiceNo`);

-- 2) Tenant ownership and timestamps on InvoiceItem/PaymentMilestone.
ALTER TABLE `InvoiceItem`
  ADD COLUMN `orgId` VARCHAR(191) NULL,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `InvoiceItem` ii
JOIN `Invoice` i ON i.id = ii.invoiceId
SET ii.orgId = i.orgId
WHERE ii.orgId IS NULL;

ALTER TABLE `InvoiceItem`
  MODIFY `orgId` VARCHAR(191) NOT NULL,
  ADD INDEX `InvoiceItem_orgId_invoiceId_idx`(`orgId`, `invoiceId`),
  ADD CONSTRAINT `InvoiceItem_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PaymentMilestone`
  ADD COLUMN `orgId` VARCHAR(191) NULL,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `PaymentMilestone` pm
JOIN `Invoice` i ON i.id = pm.invoiceId
SET pm.orgId = i.orgId
WHERE pm.orgId IS NULL;

ALTER TABLE `PaymentMilestone`
  MODIFY `orgId` VARCHAR(191) NOT NULL,
  ADD INDEX `PaymentMilestone_orgId_invoiceId_idx`(`orgId`, `invoiceId`),
  ADD CONSTRAINT `PaymentMilestone_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) PaymentProof.messageId FK to Message.
ALTER TABLE `PaymentProof`
  ADD INDEX `PaymentProof_messageId_idx`(`messageId`),
  ADD CONSTRAINT `PaymentProof_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Invoice sequence table for race-safe numbering.
CREATE TABLE `InvoiceSequence` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `lastSeq` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `InvoiceSequence_orgId_year_key`(`orgId`, `year`),
  INDEX `InvoiceSequence_orgId_year_idx`(`orgId`, `year`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InvoiceSequence`
  ADD CONSTRAINT `InvoiceSequence_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
