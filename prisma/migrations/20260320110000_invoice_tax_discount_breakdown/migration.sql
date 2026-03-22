ALTER TABLE `Invoice`
  ADD COLUMN `grossSubtotalCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lineDiscountCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `invoiceDiscountType` VARCHAR(16) NOT NULL DEFAULT '%',
  ADD COLUMN `invoiceDiscountValue` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `invoiceDiscountCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `taxCents` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `InvoiceItem`
  ADD COLUMN `subtotalCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `discountType` VARCHAR(16) NOT NULL DEFAULT 'IDR',
  ADD COLUMN `discountValue` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `discountCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `taxLabel` VARCHAR(64) NULL,
  ADD COLUMN `taxRateBps` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `taxCents` INTEGER NOT NULL DEFAULT 0;

UPDATE `InvoiceItem`
SET
  `subtotalCents` = `qty` * `priceCents`,
  `discountType` = 'IDR',
  `discountValue` = 0,
  `discountCents` = 0,
  `taxLabel` = NULL,
  `taxRateBps` = 0,
  `taxCents` = 0
WHERE 1 = 1;

UPDATE `Invoice`
SET
  `grossSubtotalCents` = `subtotalCents`,
  `lineDiscountCents` = 0,
  `invoiceDiscountType` = '%',
  `invoiceDiscountValue` = 0,
  `invoiceDiscountCents` = 0,
  `taxCents` = 0
WHERE 1 = 1;
