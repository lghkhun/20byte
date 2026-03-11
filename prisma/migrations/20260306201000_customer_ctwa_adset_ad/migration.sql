-- DOC 08 alignment: persist customer attribution using campaign/adset/ad/source naming.
-- Keep platform/medium for backward compatibility.
ALTER TABLE `Customer`
  ADD COLUMN `adset` VARCHAR(191) NULL,
  ADD COLUMN `ad` VARCHAR(191) NULL;
