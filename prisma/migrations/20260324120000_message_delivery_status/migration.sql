-- Add outbound delivery/read status tracking for WhatsApp-like check indicators
SET @schema_name = DATABASE();

SET @has_delivery_status = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Message' AND COLUMN_NAME='deliveryStatus'
);
SET @sql_delivery_status = IF(
  @has_delivery_status=0,
  'ALTER TABLE `Message` ADD COLUMN `deliveryStatus` ENUM(''SENT'', ''DELIVERED'', ''READ'') NULL',
  'SELECT 1'
);
PREPARE stmt_delivery_status FROM @sql_delivery_status;
EXECUTE stmt_delivery_status;
DEALLOCATE PREPARE stmt_delivery_status;

SET @has_delivered_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Message' AND COLUMN_NAME='deliveredAt'
);
SET @sql_delivered_at = IF(
  @has_delivered_at=0,
  'ALTER TABLE `Message` ADD COLUMN `deliveredAt` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt_delivered_at FROM @sql_delivered_at;
EXECUTE stmt_delivered_at;
DEALLOCATE PREPARE stmt_delivered_at;

SET @has_read_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Message' AND COLUMN_NAME='readAt'
);
SET @sql_read_at = IF(
  @has_read_at=0,
  'ALTER TABLE `Message` ADD COLUMN `readAt` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt_read_at FROM @sql_read_at;
EXECUTE stmt_read_at;
DEALLOCATE PREPARE stmt_read_at;
