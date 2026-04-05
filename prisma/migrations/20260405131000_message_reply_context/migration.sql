ALTER TABLE `Message`
  ADD COLUMN `replyToMessageId` VARCHAR(191) NULL,
  ADD COLUMN `replyToWaMessageId` VARCHAR(191) NULL,
  ADD COLUMN `replyPreviewText` VARCHAR(191) NULL;

CREATE INDEX `msg_org_conv_reply_created_idx`
  ON `Message`(`orgId`, `conversationId`, `replyToMessageId`, `createdAt`);
