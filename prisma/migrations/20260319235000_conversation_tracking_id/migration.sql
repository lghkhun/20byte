ALTER TABLE `Conversation`
  ADD COLUMN `trackingId` VARCHAR(191) NULL;

CREATE INDEX `Conversation_trackingId_idx` ON `Conversation`(`trackingId`);
