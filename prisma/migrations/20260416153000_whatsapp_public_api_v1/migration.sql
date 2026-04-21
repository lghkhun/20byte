-- WhatsApp Public API v1: API key, webhook config, schedule, and webhook event outbox

CREATE TABLE `OrgWhatsAppApiKey` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `keyPrefix` VARCHAR(191) NOT NULL,
  `keyHash` CHAR(64) NOT NULL,
  `lastFour` CHAR(4) NOT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `rotatedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `OrgWhatsAppApiKey_orgId_key`(`orgId`),
  UNIQUE INDEX `OrgWhatsAppApiKey_keyHash_key`(`keyHash`),
  INDEX `OrgWhatsAppApiKey_orgId_revokedAt_createdAt_idx`(`orgId`, `revokedAt`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgWhatsAppPublicWebhook` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `url` VARCHAR(191) NULL,
  `secretEnc` VARCHAR(191) NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `eventFiltersJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `OrgWhatsAppPublicWebhook_orgId_key`(`orgId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgWhatsAppPublicSchedule` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
  `targetType` VARCHAR(191) NOT NULL,
  `target` VARCHAR(191) NOT NULL,
  `messageType` VARCHAR(191) NOT NULL,
  `text` LONGTEXT NULL,
  `mediaUrl` LONGTEXT NULL,
  `mimeType` VARCHAR(191) NULL,
  `fileName` VARCHAR(191) NULL,
  `dueAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `canceledAt` DATETIME(3) NULL,
  `failedAt` DATETIME(3) NULL,
  `waMessageId` VARCHAR(191) NULL,
  `failureCode` VARCHAR(191) NULL,
  `failureMessage` TEXT NULL,
  `retryCount` INT NOT NULL DEFAULT 0,
  `nextRetryAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `OrgWhatsAppPublicSchedule_orgId_status_dueAt_idx`(`orgId`, `status`, `dueAt`),
  INDEX `OrgWhatsAppPublicSchedule_status_dueAt_idx`(`status`, `dueAt`),
  INDEX `OrgWhatsAppPublicSchedule_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgWhatsAppPublicWebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `attempts` INT NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `OrgWhatsAppPublicWebhookEvent_eventId_key`(`eventId`),
  INDEX `OrgWhatsAppPublicWebhookEvent_orgId_status_createdAt_idx`(`orgId`, `status`, `createdAt`),
  INDEX `OrgWhatsAppPublicWebhookEvent_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrgWhatsAppApiKey`
  ADD CONSTRAINT `OrgWhatsAppApiKey_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWhatsAppApiKey`
  ADD CONSTRAINT `OrgWhatsAppApiKey_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWhatsAppPublicWebhook`
  ADD CONSTRAINT `OrgWhatsAppPublicWebhook_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWhatsAppPublicSchedule`
  ADD CONSTRAINT `OrgWhatsAppPublicSchedule_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgWhatsAppPublicSchedule`
  ADD CONSTRAINT `OrgWhatsAppPublicSchedule_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrgWhatsAppPublicWebhookEvent`
  ADD CONSTRAINT `OrgWhatsAppPublicWebhookEvent_orgId_fkey`
  FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
