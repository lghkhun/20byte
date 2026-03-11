-- DOC 08 compliance: enrich shortlink attribution fields and support manual disable.
ALTER TABLE `Shortlink`
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'meta_ads',
  ADD COLUMN `adset` VARCHAR(191) NULL,
  ADD COLUMN `adName` VARCHAR(191) NULL,
  ADD COLUMN `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `disabledAt` DATETIME(3) NULL;
