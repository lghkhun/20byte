-- AlterTable
ALTER TABLE `Invoice` MODIFY `invoiceDiscountType` VARCHAR(191) NOT NULL DEFAULT '%';

-- AlterTable
ALTER TABLE `InvoiceItem` MODIFY `discountType` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    MODIFY `taxLabel` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Message` MODIFY `templateComponentsJson` VARCHAR(191) NULL,
    MODIFY `sendError` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `MetaIntegration` MODIFY `accessTokenEnc` TEXT NOT NULL;
