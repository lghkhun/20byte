ALTER TABLE `Customer`
  ADD COLUMN `leadStatus` VARCHAR(191) NOT NULL DEFAULT 'NEW_LEAD',
  ADD COLUMN `followUpStatus` VARCHAR(191) NULL,
  ADD COLUMN `businessCategory` VARCHAR(191) NULL,
  ADD COLUMN `detail` VARCHAR(191) NULL,
  ADD COLUMN `hotness` VARCHAR(191) NOT NULL DEFAULT 'COLD',
  ADD COLUMN `packageName` VARCHAR(191) NULL,
  ADD COLUMN `projectValueCents` INTEGER NULL,
  ADD COLUMN `remarks` TEXT NULL,
  ADD COLUMN `assignedToMemberId` VARCHAR(191) NULL;

CREATE INDEX `Customer_orgId_leadStatus_firstContactAt_idx` ON `Customer`(`orgId`, `leadStatus`, `firstContactAt`);
CREATE INDEX `Customer_orgId_hotness_firstContactAt_idx` ON `Customer`(`orgId`, `hotness`, `firstContactAt`);
CREATE INDEX `Customer_orgId_assignedToMemberId_firstContactAt_idx` ON `Customer`(`orgId`, `assignedToMemberId`, `firstContactAt`);
CREATE INDEX `Customer_orgId_source_firstContactAt_idx` ON `Customer`(`orgId`, `source`, `firstContactAt`);
