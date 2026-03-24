-- Backfill CRM schema into migration history (safe/idempotent)
SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS `CrmPipeline` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CrmPipeline_orgId_createdAt_idx`(`orgId`, `createdAt`),
  UNIQUE INDEX `CrmPipeline_orgId_name_key`(`orgId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CrmPipelineStage` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `pipelineId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NOT NULL DEFAULT 'emerald',
  `position` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CrmPipelineStage_orgId_pipelineId_position_idx`(`orgId`, `pipelineId`, `position`),
  UNIQUE INDEX `CrmPipelineStage_pipelineId_name_key`(`pipelineId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @conv_has_crm_pipeline_id = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND COLUMN_NAME='crmPipelineId'
);
SET @sql_conv_add_crm_pipeline_id = IF(
  @conv_has_crm_pipeline_id=0,
  'ALTER TABLE `Conversation` ADD COLUMN `crmPipelineId` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt_conv_add_crm_pipeline_id FROM @sql_conv_add_crm_pipeline_id;
EXECUTE stmt_conv_add_crm_pipeline_id;
DEALLOCATE PREPARE stmt_conv_add_crm_pipeline_id;

SET @conv_has_crm_stage_id = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND COLUMN_NAME='crmStageId'
);
SET @sql_conv_add_crm_stage_id = IF(
  @conv_has_crm_stage_id=0,
  'ALTER TABLE `Conversation` ADD COLUMN `crmStageId` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt_conv_add_crm_stage_id FROM @sql_conv_add_crm_stage_id;
EXECUTE stmt_conv_add_crm_stage_id;
DEALLOCATE PREPARE stmt_conv_add_crm_stage_id;

SET @idx_conv_crm_pipeline_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND INDEX_NAME='Conversation_crmPipelineId_idx'
);
SET @sql_idx_conv_crm_pipeline = IF(
  @idx_conv_crm_pipeline_exists=0,
  'CREATE INDEX `Conversation_crmPipelineId_idx` ON `Conversation`(`crmPipelineId`)',
  'SELECT 1'
);
PREPARE stmt_idx_conv_crm_pipeline FROM @sql_idx_conv_crm_pipeline;
EXECUTE stmt_idx_conv_crm_pipeline;
DEALLOCATE PREPARE stmt_idx_conv_crm_pipeline;

SET @idx_conv_crm_stage_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND INDEX_NAME='Conversation_crmStageId_idx'
);
SET @sql_idx_conv_crm_stage = IF(
  @idx_conv_crm_stage_exists=0,
  'CREATE INDEX `Conversation_crmStageId_idx` ON `Conversation`(`crmStageId`)',
  'SELECT 1'
);
PREPARE stmt_idx_conv_crm_stage FROM @sql_idx_conv_crm_stage;
EXECUTE stmt_idx_conv_crm_stage;
DEALLOCATE PREPARE stmt_idx_conv_crm_stage;

SET @idx_conv_org_status_pipe_last_upd_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND INDEX_NAME='conv_org_status_pipe_last_upd_idx'
);
SET @sql_idx_conv_org_status_pipe_last_upd = IF(
  @idx_conv_org_status_pipe_last_upd_exists=0,
  'CREATE INDEX `conv_org_status_pipe_last_upd_idx` ON `Conversation`(`orgId`, `status`, `crmPipelineId`, `lastMessageAt`, `updatedAt`)',
  'SELECT 1'
);
PREPARE stmt_idx_conv_org_status_pipe_last_upd FROM @sql_idx_conv_org_status_pipe_last_upd;
EXECUTE stmt_idx_conv_org_status_pipe_last_upd;
DEALLOCATE PREPARE stmt_idx_conv_org_status_pipe_last_upd;

SET @idx_conv_org_asg_st_pipe_last_upd_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND INDEX_NAME='conv_org_asg_st_pipe_last_upd_idx'
);
SET @sql_idx_conv_org_asg_st_pipe_last_upd = IF(
  @idx_conv_org_asg_st_pipe_last_upd_exists=0,
  'CREATE INDEX `conv_org_asg_st_pipe_last_upd_idx` ON `Conversation`(`orgId`, `assignedToMemberId`, `status`, `crmPipelineId`, `lastMessageAt`, `updatedAt`)',
  'SELECT 1'
);
PREPARE stmt_idx_conv_org_asg_st_pipe_last_upd FROM @sql_idx_conv_org_asg_st_pipe_last_upd;
EXECUTE stmt_idx_conv_org_asg_st_pipe_last_upd;
DEALLOCATE PREPARE stmt_idx_conv_org_asg_st_pipe_last_upd;

SET @fk_conv_pipeline_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND CONSTRAINT_NAME='Conversation_crmPipelineId_fkey' AND CONSTRAINT_TYPE='FOREIGN KEY'
);
SET @sql_fk_conv_pipeline = IF(
  @fk_conv_pipeline_exists=0,
  'ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_crmPipelineId_fkey` FOREIGN KEY (`crmPipelineId`) REFERENCES `CrmPipeline`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_fk_conv_pipeline FROM @sql_fk_conv_pipeline;
EXECUTE stmt_fk_conv_pipeline;
DEALLOCATE PREPARE stmt_fk_conv_pipeline;

SET @fk_conv_stage_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='Conversation' AND CONSTRAINT_NAME='Conversation_crmStageId_fkey' AND CONSTRAINT_TYPE='FOREIGN KEY'
);
SET @sql_fk_conv_stage = IF(
  @fk_conv_stage_exists=0,
  'ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_crmStageId_fkey` FOREIGN KEY (`crmStageId`) REFERENCES `CrmPipelineStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_fk_conv_stage FROM @sql_fk_conv_stage;
EXECUTE stmt_fk_conv_stage;
DEALLOCATE PREPARE stmt_fk_conv_stage;

SET @fk_pipeline_org_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='CrmPipeline' AND CONSTRAINT_NAME='CrmPipeline_orgId_fkey' AND CONSTRAINT_TYPE='FOREIGN KEY'
);
SET @sql_fk_pipeline_org = IF(
  @fk_pipeline_org_exists=0,
  'ALTER TABLE `CrmPipeline` ADD CONSTRAINT `CrmPipeline_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_fk_pipeline_org FROM @sql_fk_pipeline_org;
EXECUTE stmt_fk_pipeline_org;
DEALLOCATE PREPARE stmt_fk_pipeline_org;

SET @fk_stage_org_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='CrmPipelineStage' AND CONSTRAINT_NAME='CrmPipelineStage_orgId_fkey' AND CONSTRAINT_TYPE='FOREIGN KEY'
);
SET @sql_fk_stage_org = IF(
  @fk_stage_org_exists=0,
  'ALTER TABLE `CrmPipelineStage` ADD CONSTRAINT `CrmPipelineStage_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_fk_stage_org FROM @sql_fk_stage_org;
EXECUTE stmt_fk_stage_org;
DEALLOCATE PREPARE stmt_fk_stage_org;

SET @fk_stage_pipeline_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='CrmPipelineStage' AND CONSTRAINT_NAME='CrmPipelineStage_pipelineId_fkey' AND CONSTRAINT_TYPE='FOREIGN KEY'
);
SET @sql_fk_stage_pipeline = IF(
  @fk_stage_pipeline_exists=0,
  'ALTER TABLE `CrmPipelineStage` ADD CONSTRAINT `CrmPipelineStage_pipelineId_fkey` FOREIGN KEY (`pipelineId`) REFERENCES `CrmPipeline`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_fk_stage_pipeline FROM @sql_fk_stage_pipeline;
EXECUTE stmt_fk_stage_pipeline;
DEALLOCATE PREPARE stmt_fk_stage_pipeline;
