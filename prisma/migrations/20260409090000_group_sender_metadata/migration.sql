ALTER TABLE `Conversation`
  ADD COLUMN `groupParticipantsJson` LONGTEXT NULL;

ALTER TABLE `Message`
  ADD COLUMN `replyPreviewSenderName` VARCHAR(191) NULL,
  ADD COLUMN `senderWaJid` VARCHAR(191) NULL,
  ADD COLUMN `senderPhoneE164` VARCHAR(191) NULL,
  ADD COLUMN `senderDisplayName` VARCHAR(191) NULL;
