-- Query performance indexes for CRM board and customer listing.
-- Guarded to support historical migration order on clean shadow DB.
SET @schema_name = DATABASE();

SET @cust_idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Customer'
    AND INDEX_NAME = 'cust_org_firstcontact_created_idx'
);

SET @sql_cust_idx = IF(
  @cust_idx_exists = 0,
  'CREATE INDEX `cust_org_firstcontact_created_idx` ON `Customer`(`orgId`, `firstContactAt`, `createdAt`)',
  'SELECT 1'
);
PREPARE stmt_cust_idx FROM @sql_cust_idx;
EXECUTE stmt_cust_idx;
DEALLOCATE PREPARE stmt_cust_idx;

SET @conv_has_crm_pipeline_id = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Conversation'
    AND COLUMN_NAME = 'crmPipelineId'
);

SET @conv_status_pipe_idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Conversation'
    AND INDEX_NAME = 'conv_org_status_pipe_last_upd_idx'
);

SET @sql_conv_status_pipe_idx = IF(
  @conv_has_crm_pipeline_id > 0 AND @conv_status_pipe_idx_exists = 0,
  'CREATE INDEX `conv_org_status_pipe_last_upd_idx` ON `Conversation`(`orgId`, `status`, `crmPipelineId`, `lastMessageAt`, `updatedAt`)',
  'SELECT 1'
);
PREPARE stmt_conv_status_pipe_idx FROM @sql_conv_status_pipe_idx;
EXECUTE stmt_conv_status_pipe_idx;
DEALLOCATE PREPARE stmt_conv_status_pipe_idx;

SET @conv_asg_pipe_idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Conversation'
    AND INDEX_NAME = 'conv_org_asg_st_pipe_last_upd_idx'
);

SET @sql_conv_asg_pipe_idx = IF(
  @conv_has_crm_pipeline_id > 0 AND @conv_asg_pipe_idx_exists = 0,
  'CREATE INDEX `conv_org_asg_st_pipe_last_upd_idx` ON `Conversation`(`orgId`, `assignedToMemberId`, `status`, `crmPipelineId`, `lastMessageAt`, `updatedAt`)',
  'SELECT 1'
);
PREPARE stmt_conv_asg_pipe_idx FROM @sql_conv_asg_pipe_idx;
EXECUTE stmt_conv_asg_pipe_idx;
DEALLOCATE PREPARE stmt_conv_asg_pipe_idx;
