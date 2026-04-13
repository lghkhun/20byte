ALTER TABLE `MetaIntegration`
  ADD COLUMN `datasetId` VARCHAR(191) NULL AFTER `pixelId`;

ALTER TABLE `ShortlinkClick`
  ADD COLUMN `fbclid` VARCHAR(191) NULL AFTER `trackingId`,
  ADD COLUMN `fbc` VARCHAR(191) NULL AFTER `fbclid`,
  ADD COLUMN `fbp` VARCHAR(191) NULL AFTER `fbc`;

ALTER TABLE `Conversation`
  ADD COLUMN `fbclid` VARCHAR(191) NULL AFTER `trackingId`,
  ADD COLUMN `fbc` VARCHAR(191) NULL AFTER `fbclid`,
  ADD COLUMN `fbp` VARCHAR(191) NULL AFTER `fbc`,
  ADD COLUMN `ctwaClid` VARCHAR(191) NULL AFTER `fbp`,
  ADD COLUMN `wabaId` VARCHAR(191) NULL AFTER `ctwaClid`;

CREATE INDEX `ShortlinkClick_fbclid_idx` ON `ShortlinkClick`(`fbclid`);
CREATE INDEX `Conversation_ctwaClid_idx` ON `Conversation`(`ctwaClid`);

CREATE TABLE `MetaEventDispatch` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `dedupeKey` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `sentAt` DATETIME(3) NULL,
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MetaEventDispatch_orgId_dedupeKey_key`(`orgId`, `dedupeKey`),
  INDEX `MetaEventDispatch_orgId_sentAt_updatedAt_idx`(`orgId`, `sentAt`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MetaEventDispatch`
  ADD CONSTRAINT `MetaEventDispatch_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
