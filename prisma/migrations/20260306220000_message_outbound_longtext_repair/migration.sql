-- Repair drift on environments where message outbound reliability columns
-- were narrowed to VARCHAR(191). Keep payload/error columns as LONGTEXT.
ALTER TABLE `Message`
  MODIFY `templateComponentsJson` LONGTEXT NULL,
  MODIFY `sendError` LONGTEXT NULL;
