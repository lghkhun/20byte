-- Optimize customer picker and high-traffic customer sorting paths.
ALTER TABLE `Customer`
  ADD INDEX `Customer_orgId_updatedAt_idx` (`orgId`, `updatedAt`),
  ADD INDEX `Customer_orgId_displayName_idx` (`orgId`, `displayName`);
