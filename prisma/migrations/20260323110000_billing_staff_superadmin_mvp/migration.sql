-- MVP billing + staff onboarding + superadmin foundation

ALTER TABLE `User`
  ADD COLUMN `phoneE164` VARCHAR(191) NULL,
  ADD COLUMN `passwordSetAt` DATETIME(3) NULL,
  ADD COLUMN `securityNoticeDismissedAt` DATETIME(3) NULL,
  ADD COLUMN `isSuspended` BOOLEAN NOT NULL DEFAULT false,
  MODIFY `passwordHash` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_phoneE164_key` ON `User`(`phoneE164`);
CREATE INDEX `User_phoneE164_idx` ON `User`(`phoneE164`);

CREATE TABLE `AccountSetupToken` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `purpose` ENUM('SET_PASSWORD') NOT NULL DEFAULT 'SET_PASSWORD',
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AccountSetupToken_tokenHash_key`(`tokenHash`),
  INDEX `AccountSetupToken_orgId_userId_purpose_idx`(`orgId`, `userId`, `purpose`),
  INDEX `AccountSetupToken_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrgSubscription` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `status` ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED') NOT NULL DEFAULT 'TRIALING',
  `trialStartAt` DATETIME(3) NOT NULL,
  `trialEndAt` DATETIME(3) NOT NULL,
  `graceDays` INTEGER NOT NULL DEFAULT 3,
  `currentPeriodStartAt` DATETIME(3) NULL,
  `currentPeriodEndAt` DATETIME(3) NULL,
  `nextDueAt` DATETIME(3) NULL,
  `baseAmountCents` INTEGER NOT NULL DEFAULT 99000,
  `gatewayFeeBps` INTEGER NOT NULL DEFAULT 200,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
  `lastPaidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `OrgSubscription_orgId_key`(`orgId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BillingCharge` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `baseAmountCents` INTEGER NOT NULL,
  `gatewayFeeCents` INTEGER NOT NULL,
  `totalAmountCents` INTEGER NOT NULL,
  `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'qris',
  `gatewayProvider` VARCHAR(191) NOT NULL DEFAULT 'pakasir',
  `gatewayProjectSlug` VARCHAR(191) NOT NULL,
  `gatewayRawJson` LONGTEXT NULL,
  `paymentNumber` LONGTEXT NULL,
  `expiredAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `BillingCharge_orderId_key`(`orderId`),
  INDEX `BillingCharge_orgId_createdAt_idx`(`orgId`, `createdAt`),
  INDEX `BillingCharge_orgId_status_createdAt_idx`(`orgId`, `status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformMember` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('SUPERADMIN') NOT NULL DEFAULT 'SUPERADMIN',
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PlatformMember_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `metaJson` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `PlatformAuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
  INDEX `PlatformAuditLog_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AccountSetupToken`
  ADD CONSTRAINT `AccountSetupToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `AccountSetupToken_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrgSubscription`
  ADD CONSTRAINT `OrgSubscription_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BillingCharge`
  ADD CONSTRAINT `BillingCharge_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PlatformMember`
  ADD CONSTRAINT `PlatformMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill subscription for existing orgs from current date.
INSERT INTO `OrgSubscription` (
  `id`, `orgId`, `status`, `trialStartAt`, `trialEndAt`, `graceDays`,
  `baseAmountCents`, `gatewayFeeBps`, `currency`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('sub_', REPLACE(`id`, '-', '')),
  `id`,
  'TRIALING',
  CURRENT_TIMESTAMP(3),
  DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 14 DAY),
  3,
  99000,
  200,
  'IDR',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `Org`
WHERE `id` NOT IN (SELECT `orgId` FROM `OrgSubscription`);
