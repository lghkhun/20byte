-- Guarded repair for historical drift:
-- At this point in migration order, these columns may not exist yet on clean shadow DB.
SET @schema_name = DATABASE();

SET @has_template_components_json = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Message'
    AND COLUMN_NAME = 'templateComponentsJson'
);

SET @sql_template_components_json = IF(
  @has_template_components_json > 0,
  'ALTER TABLE `Message` MODIFY `templateComponentsJson` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt_template_components_json FROM @sql_template_components_json;
EXECUTE stmt_template_components_json;
DEALLOCATE PREPARE stmt_template_components_json;

SET @has_send_error = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Message'
    AND COLUMN_NAME = 'sendError'
);

SET @sql_send_error = IF(
  @has_send_error > 0,
  'ALTER TABLE `Message` MODIFY `sendError` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt_send_error FROM @sql_send_error;
EXECUTE stmt_send_error;
DEALLOCATE PREPARE stmt_send_error;
