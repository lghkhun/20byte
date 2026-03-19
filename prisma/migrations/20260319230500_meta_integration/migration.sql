CREATE TABLE `MetaIntegration` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `pixelId` VARCHAR(191) NOT NULL,
  `accessTokenEnc` LONGTEXT NOT NULL,
  `testEventCode` VARCHAR(191) NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MetaIntegration_orgId_key`(`orgId`),
  INDEX `MetaIntegration_orgId_idx`(`orgId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MetaIntegration`
  ADD CONSTRAINT `MetaIntegration_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
