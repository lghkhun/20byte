ALTER TABLE `Customer`
  ADD COLUMN `followUpAt` DATETIME(3) NULL;

CREATE INDEX `Customer_orgId_followUpAt_idx` ON `Customer`(`orgId`, `followUpAt`);
