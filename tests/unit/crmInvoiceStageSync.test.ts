import assert from "node:assert/strict";
import test from "node:test";

import { pickTargetStageForInvoiceSync, rankStageNameForInvoiceTarget } from "@/server/services/crmPipelineService";

test("rankStageNameForInvoiceTarget prioritizes invoice stage for INVOICE_SENT", () => {
  assert.equal(rankStageNameForInvoiceTarget("Invoice", "INVOICE_SENT") > rankStageNameForInvoiceTarget("Inisiasi Chat", "INVOICE_SENT"), true);
});

test("rankStageNameForInvoiceTarget prioritizes payment stage for INVOICE_PAID", () => {
  assert.equal(rankStageNameForInvoiceTarget("Closing & Pembayaran", "INVOICE_PAID") > rankStageNameForInvoiceTarget("Invoice", "INVOICE_PAID"), true);
});

test("pickTargetStageForInvoiceSync selects best stage by score then position", () => {
  const stages = [
    { id: "s1", name: "Inisiasi Chat", position: 0 },
    { id: "s2", name: "Invoice", position: 1 },
    { id: "s3", name: "Penawaran & Follow Up", position: 2 },
    { id: "s4", name: "Closing & Pembayaran", position: 3 }
  ];

  const sentStage = pickTargetStageForInvoiceSync(stages, "INVOICE_SENT");
  assert.equal(sentStage?.id, "s2");

  const paidStage = pickTargetStageForInvoiceSync(stages, "INVOICE_PAID");
  assert.equal(paidStage?.id, "s4");
});

