ALTER TABLE `ShortlinkClick`
  ADD COLUMN `trackingId` VARCHAR(191) NULL;

CREATE INDEX `ShortlinkClick_trackingId_idx` ON `ShortlinkClick`(`trackingId`);
