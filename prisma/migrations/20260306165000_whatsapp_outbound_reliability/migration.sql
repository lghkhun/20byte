-- Ensure each org has at most one WhatsApp account row before adding unique org constraint.
DELETE wa_old
FROM `WaAccount` wa_old
JOIN `WaAccount` wa_newer
  ON wa_old.orgId = wa_newer.orgId
 AND (
   wa_old.connectedAt < wa_newer.connectedAt
   OR (wa_old.connectedAt = wa_newer.connectedAt AND wa_old.id < wa_newer.id)
 );

-- Enforce 1 organization = 1 WhatsApp number at database level.
ALTER TABLE `WaAccount`
  ADD UNIQUE INDEX `WaAccount_orgId_key`(`orgId`);

-- Add outbound delivery/error tracking + template payload fields.
ALTER TABLE `Message`
  ADD COLUMN `templateLanguageCode` VARCHAR(191) NULL,
  ADD COLUMN `templateComponentsJson` LONGTEXT NULL,
  ADD COLUMN `sendStatus` ENUM('PENDING', 'SENT', 'FAILED') NULL,
  ADD COLUMN `sendError` LONGTEXT NULL,
  ADD COLUMN `sendAttemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastSendAttemptAt` DATETIME(3) NULL,
  ADD COLUMN `retryable` BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing outbound rows as already sent.
UPDATE `Message`
SET
  `sendStatus` = 'SENT',
  `sendAttemptCount` = 1,
  `lastSendAttemptAt` = `createdAt`
WHERE `direction` = 'OUTBOUND';
