-- Optimize inbox conversation/message/CRM-context queries for larger datasets.
ALTER TABLE `Conversation`
  ADD INDEX `conv_org_status_lastmsg_upd_idx` (`orgId`, `status`, `lastMessageAt`, `updatedAt`),
  ADD INDEX `conv_org_assignee_status_lastmsg_upd_idx` (`orgId`, `assignedToMemberId`, `status`, `lastMessageAt`, `updatedAt`);

ALTER TABLE `Message`
  ADD INDEX `msg_org_conv_created_idx` (`orgId`, `conversationId`, `createdAt`);

ALTER TABLE `Invoice`
  ADD INDEX `inv_org_conv_created_idx` (`orgId`, `conversationId`, `createdAt`);

ALTER TABLE `PaymentMilestone`
  ADD INDEX `pm_org_status_paidat_idx` (`orgId`, `status`, `paidAt`);

ALTER TABLE `AuditLog`
  ADD INDEX `alog_org_etype_act_eid_created_idx` (`orgId`, `entityType`, `action`, `entityId`, `createdAt`);
