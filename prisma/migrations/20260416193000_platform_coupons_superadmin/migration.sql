-- Platform coupons for billing and business provisioning checkout

ALTER TABLE `BillingCharge`
  ADD COLUMN `appliedCouponCode` VARCHAR(191) NULL,
  ADD COLUMN `couponDiscountCents` INT NOT NULL DEFAULT 0,
  ADD COLUMN `couponSnapshotJson` LONGTEXT NULL;

ALTER TABLE `OwnerBusinessProvisioningOrder`
  ADD COLUMN `appliedCouponCode` VARCHAR(191) NULL,
  ADD COLUMN `couponDiscountCents` INT NOT NULL DEFAULT 0,
  ADD COLUMN `couponSnapshotJson` LONGTEXT NULL;

CREATE TABLE `PlatformCoupon` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `discountType` ENUM('FIXED', 'PERCENT') NOT NULL,
  `discountValue` INT NOT NULL,
  `maxDiscountCents` INT NULL,
  `minSubtotalCents` INT NULL,
  `maxRedemptions` INT NULL,
  `redeemedCount` INT NOT NULL DEFAULT 0,
  `target` ENUM('BILLING', 'BUSINESS_PROVISIONING', 'ALL') NOT NULL DEFAULT 'ALL',
  `startsAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdByUserId` VARCHAR(191) NULL,
  `updatedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PlatformCoupon_code_key`(`code`),
  INDEX `PlatformCoupon_isActive_code_idx`(`isActive`, `code`),
  INDEX `PlatformCoupon_target_isActive_expiresAt_idx`(`target`, `isActive`, `expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformCouponRedemption` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `couponCode` VARCHAR(191) NOT NULL,
  `targetType` ENUM('BILLING', 'BUSINESS_PROVISIONING', 'ALL') NOT NULL,
  `orgId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `billingChargeId` VARCHAR(191) NULL,
  `provisioningOrderId` VARCHAR(191) NULL,
  `subtotalCents` INT NOT NULL,
  `discountCents` INT NOT NULL,
  `finalAmountCents` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PlatformCouponRedemption_billingChargeId_key`(`billingChargeId`),
  UNIQUE INDEX `PlatformCouponRedemption_provisioningOrderId_key`(`provisioningOrderId`),
  INDEX `PlatformCouponRedemption_couponId_createdAt_idx`(`couponId`, `createdAt`),
  INDEX `PlatformCouponRedemption_orgId_createdAt_idx`(`orgId`, `createdAt`),
  INDEX `PlatformCouponRedemption_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `PlatformCouponRedemption_targetType_createdAt_idx`(`targetType`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PlatformCouponRedemption`
  ADD CONSTRAINT `PlatformCouponRedemption_couponId_fkey`
  FOREIGN KEY (`couponId`) REFERENCES `PlatformCoupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PlatformCouponRedemption`
  ADD CONSTRAINT `PlatformCouponRedemption_billingChargeId_fkey`
  FOREIGN KEY (`billingChargeId`) REFERENCES `BillingCharge`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PlatformCouponRedemption`
  ADD CONSTRAINT `PlatformCouponRedemption_provisioningOrderId_fkey`
  FOREIGN KEY (`provisioningOrderId`) REFERENCES `OwnerBusinessProvisioningOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
