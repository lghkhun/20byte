-- Ensure createdAt exists on all business tables per tenant audit policy.
ALTER TABLE `WaAccount`
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `WaAccount`
SET `createdAt` = `connectedAt`
WHERE `createdAt` IS NULL;

ALTER TABLE `ShortlinkClick`
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `ShortlinkClick`
SET `createdAt` = `clickedAt`
WHERE `createdAt` IS NULL;
