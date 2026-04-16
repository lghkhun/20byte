-- Enable owner multi-business provisioning via paid checkout

CREATE TABLE `OwnerBusinessProvisioningOrder` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `businessName` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `baseAmountCents` INT NOT NULL,
  `gatewayFeeCents` INT NOT NULL,
  `totalAmountCents` INT NOT NULL,
  `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'qris',
  `gatewayProvider` VARCHAR(191) NOT NULL DEFAULT 'pakasir',
  `gatewayProjectSlug` VARCHAR(191) NOT NULL,
  `gatewayRawJson` LONGTEXT NULL,
  `paymentNumber` LONGTEXT NULL,
  `expiredAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdOrgId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `OwnerBusinessProvisioningOrder_orderId_key`(`orderId`),
  UNIQUE INDEX `OwnerBusinessProvisioningOrder_createdOrgId_key`(`createdOrgId`),
  INDEX `OwnerBusinessProvisioningOrder_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `OwnerBusinessProvisioningOrder_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OwnerBusinessProvisioningOrder`
  ADD CONSTRAINT `OwnerBusinessProvisioningOrder_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OwnerBusinessProvisioningOrder`
  ADD CONSTRAINT `OwnerBusinessProvisioningOrder_createdOrgId_fkey`
  FOREIGN KEY (`createdOrgId`) REFERENCES `Org`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
