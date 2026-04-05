ALTER TABLE `Message`
  ADD COLUMN `replyToMessageId` VARCHAR(191) NULL,
  ADD COLUMN `replyToWaMessageId` VARCHAR(191) NULL,
  ADD COLUMN `replyPreviewText` VARCHAR(191) NULL;

ALTER TABLE `Conversation`
  ADD COLUMN `waChatJid` VARCHAR(191) NULL;

CREATE INDEX `msg_org_conv_reply_created_idx`
  ON `Message`(`orgId`, `conversationId`, `replyToMessageId`, `createdAt`);

CREATE INDEX `conv_org_wa_chat_jid_idx`
  ON `Conversation`(`orgId`, `waChatJid`);
