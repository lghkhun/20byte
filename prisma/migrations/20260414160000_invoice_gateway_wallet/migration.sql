CREATE TABLE `OrgInvoicePaymentSetting` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `enableBankTransfer` BOOLEAN NOT NULL DEFAULT true,
  `enableQris` BOOLEAN NOT NULL DEFAULT false,
  `enabledVaMethodsJson` LONGTEXT NOT NULL,
  `feePolicy` ENUM('MERCHANT','CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  `autoConfirmLabelEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `OrgInvoicePaymentSetting_orgId_key`(`orgId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InvoicePaymentAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL DEFAULT 'pakasir',
  `paymentMethod` VARCHAR(191) NOT NULL,
  `feePolicy` ENUM('MERCHANT','CUSTOMER') NOT NULL,
  `invoiceAmountCents` INT NOT NULL,
  `feeCents` INT NOT NULL DEFAULT 0,
  `customerPayableCents` INT NOT NULL,
  `status` ENUM('PENDING','PAID','EXPIRED','CANCELED','FAILED','SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `paymentNumber` LONGTEXT NULL,
  `expiresAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `gatewayRawJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `InvoicePaymentAttempt_orderId_key`(`orderId`),
  INDEX `InvoicePaymentAttempt_orgId_invoiceId_createdAt_idx`(`orgId`, `invoiceId`, `createdAt`),
  INDEX `InvoicePaymentAttempt_orgId_status_createdAt_idx`(`orgId`, `status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgWalletTopup` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `amountCents` INT NOT NULL,
  `feeCents` INT NOT NULL DEFAULT 0,
  `customerPayableCents` INT NOT NULL,
  `paymentMethod` VARCHAR(191) NOT NULL,
  `paymentNumber` LONGTEXT NULL,
  `status` ENUM('PENDING','PAID','EXPIRED','CANCELED','FAILED') NOT NULL DEFAULT 'PENDING',
  `expiresAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `gatewayRawJson` LONGTEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `OrgWalletTopup_orderId_key`(`orderId`),
  INDEX `OrgWalletTopup_orgId_status_createdAt_idx`(`orgId`, `status`, `createdAt`),
  INDEX `OrgWalletTopup_orgId_createdAt_idx`(`orgId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgWalletLedger` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `type` ENUM('TOPUP_CREDIT','WITHDRAW_DEBIT','WITHDRAW_REFUND','INVOICE_FEE_DEBIT') NOT NULL,
  `direction` ENUM('CREDIT','DEBIT') NOT NULL,
  `amountCents` INT NOT NULL,
  `balanceAfterCents` INT NOT NULL,
  `referenceType` VARCHAR(191) NOT NULL,
  `referenceId` VARCHAR(191) NOT NULL,
  `note` VARCHAR(191) NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OrgWalletLedger_orgId_createdAt_idx`(`orgId`, `createdAt`),
  INDEX `OrgWalletLedger_orgId_type_createdAt_idx`(`orgId`, `type`, `createdAt`),
  INDEX `OrgWalletLedger_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgWalletWithdrawRequest` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `amountCents` INT NOT NULL,
  `bankName` VARCHAR(191) NOT NULL,
  `accountNumber` VARCHAR(191) NOT NULL,
  `accountHolder` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING','APPROVED','PAID','REJECTED','CANCELED') NOT NULL DEFAULT 'PENDING',
  `note` TEXT NULL,
  `processedNote` TEXT NULL,
  `requestedByUserId` VARCHAR(191) NOT NULL,
  `processedByUserId` VARCHAR(191) NULL,
  `processedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `OrgWalletWithdrawRequest_orgId_status_createdAt_idx`(`orgId`, `status`, `createdAt`),
  INDEX `OrgWalletWithdrawRequest_orgId_createdAt_idx`(`orgId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrgInvoicePaymentSetting`
  ADD CONSTRAINT `OrgInvoicePaymentSetting_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InvoicePaymentAttempt`
  ADD CONSTRAINT `InvoicePaymentAttempt_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `InvoicePaymentAttempt_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWalletTopup`
  ADD CONSTRAINT `OrgWalletTopup_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWalletLedger`
  ADD CONSTRAINT `OrgWalletLedger_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWalletWithdrawRequest`
  ADD CONSTRAINT `OrgWalletWithdrawRequest_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
