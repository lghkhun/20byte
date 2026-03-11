-- Enforce globally-unique WhatsApp phone number mapping to prevent cross-org webhook resolution risk.
ALTER TABLE `WaAccount`
  ADD UNIQUE INDEX `WaAccount_phoneNumberId_key`(`phoneNumberId`);
