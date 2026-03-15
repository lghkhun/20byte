import { InvoiceKind, InvoiceStatus, PaymentMilestoneType } from "@prisma/client";

import { defaultBankAccountsJson, toDate, type SeedContext } from "@/scripts/seed/types";

export async function seedBusiness(ctx: SeedContext) {
  const { prisma } = ctx;

  const tags = [
    { id: "seed_tag_hot", orgId: "seed_org_alpha", name: "Hot Lead", color: "rose" },
    { id: "seed_tag_repeat", orgId: "seed_org_alpha", name: "Repeat", color: "emerald" },
    { id: "seed_tag_vip", orgId: "seed_org_alpha", name: "VIP", color: "amber" }
  ] as const;
  for (const tag of tags) {
    await prisma.tag.upsert({ where: { id: tag.id }, create: tag, update: { name: tag.name, color: tag.color } });
  }

  const customerTags = [
    { id: "seed_customer_tag_1", orgId: "seed_org_alpha", customerId: "seed_customer_1", tagId: "seed_tag_hot" },
    { id: "seed_customer_tag_2", orgId: "seed_org_alpha", customerId: "seed_customer_1", tagId: "seed_tag_vip" }
  ] as const;
  for (const item of customerTags) {
    await prisma.customerTag.upsert({
      where: { customerId_tagId: { customerId: item.customerId, tagId: item.tagId } },
      create: item,
      update: {}
    });
  }

  const notes = [
    { id: "seed_note_1", orgId: "seed_org_alpha", customerId: "seed_customer_1", authorUserId: "seed_user_cs", content: "[SEED] Prospek siap closing minggu ini." },
    { id: "seed_note_2", orgId: "seed_org_alpha", customerId: "seed_customer_3", authorUserId: "seed_user_admin", content: "[SEED] Follow-up after CTWA entry point." }
  ] as const;
  for (const note of notes) {
    await prisma.customerNote.upsert({ where: { id: note.id }, create: note, update: { content: note.content } });
  }

  const sequences = [
    { id: "seed_invoice_sequence_2026", orgId: "seed_org_alpha", year: 2026, lastSeq: 5 },
    { id: "seed_invoice_sequence_beta_2026", orgId: "seed_org_beta", year: 2026, lastSeq: 1 }
  ] as const;
  for (const sequence of sequences) {
    await prisma.invoiceSequence.upsert({
      where: { orgId_year: { orgId: sequence.orgId, year: sequence.year } },
      create: sequence,
      update: { lastSeq: sequence.lastSeq }
    });
  }

  const invoices = [
    { id: "seed_invoice_1", orgId: "seed_org_alpha", customerId: "seed_customer_1", conversationId: "seed_conversation_1", invoiceNo: "INV-2026-0001", kind: InvoiceKind.FULL, status: InvoiceStatus.SENT, subtotalCents: 3_500_000, totalCents: 3_500_000, publicToken: "seed-public-token-1", createdByUserId: "seed_user_admin" },
    { id: "seed_invoice_2", orgId: "seed_org_alpha", customerId: "seed_customer_1", conversationId: "seed_conversation_1", invoiceNo: "INV-2026-0002", kind: InvoiceKind.DP_AND_FINAL, status: InvoiceStatus.PARTIALLY_PAID, subtotalCents: 8_000_000, totalCents: 8_000_000, publicToken: "seed-public-token-2", createdByUserId: "seed_user_admin" },
    { id: "seed_invoice_3", orgId: "seed_org_alpha", customerId: "seed_customer_3", conversationId: "seed_conversation_4", invoiceNo: "INV-2026-0003", kind: InvoiceKind.FULL, status: InvoiceStatus.DRAFT, subtotalCents: 1_200_000, totalCents: 1_200_000, publicToken: "seed-public-token-3", createdByUserId: "seed_user_cs" },
    { id: "seed_invoice_4", orgId: "seed_org_alpha", customerId: "seed_customer_2", conversationId: "seed_conversation_2", invoiceNo: "INV-2026-0004", kind: InvoiceKind.FULL, status: InvoiceStatus.PAID, subtotalCents: 2_700_000, totalCents: 2_700_000, publicToken: "seed-public-token-4", createdByUserId: "seed_user_admin" },
    { id: "seed_invoice_5", orgId: "seed_org_alpha", customerId: "seed_customer_2", conversationId: "seed_conversation_2", invoiceNo: "INV-2026-0005", kind: InvoiceKind.FULL, status: InvoiceStatus.VOID, subtotalCents: 900_000, totalCents: 900_000, publicToken: "seed-public-token-5", createdByUserId: "seed_user_admin" },
    { id: "seed_invoice_beta_1", orgId: "seed_org_beta", customerId: "seed_customer_4", conversationId: "seed_conversation_3", invoiceNo: "INV-BETA-2026-0001", kind: InvoiceKind.FULL, status: InvoiceStatus.SENT, subtotalCents: 5_500_000, totalCents: 5_500_000, publicToken: "seed-public-token-beta-1", createdByUserId: "seed_user_owner_org_b" }
  ] as const;
  for (const invoice of invoices) {
    await prisma.invoice.upsert({
      where: { id: invoice.id },
      create: { ...invoice, bankAccountsJson: defaultBankAccountsJson() },
      update: { ...invoice, bankAccountsJson: defaultBankAccountsJson() }
    });
  }

  const items = [
    { id: "seed_item_1", orgId: "seed_org_alpha", invoiceId: "seed_invoice_1", name: "Catering Package A", qty: 1, priceCents: 3_500_000, amountCents: 3_500_000 },
    { id: "seed_item_2", orgId: "seed_org_alpha", invoiceId: "seed_invoice_2", name: "Wedding Organizer Full Day", qty: 1, priceCents: 8_000_000, amountCents: 8_000_000 },
    { id: "seed_item_3", orgId: "seed_org_alpha", invoiceId: "seed_invoice_3", name: "Social Media Booster", qty: 1, priceCents: 1_200_000, amountCents: 1_200_000 },
    { id: "seed_item_4", orgId: "seed_org_alpha", invoiceId: "seed_invoice_4", name: "Final Event Documentation", qty: 1, priceCents: 2_700_000, amountCents: 2_700_000 },
    { id: "seed_item_5", orgId: "seed_org_alpha", invoiceId: "seed_invoice_5", name: "Canceled Service Slot", qty: 1, priceCents: 900_000, amountCents: 900_000 },
    { id: "seed_item_beta_1", orgId: "seed_org_beta", invoiceId: "seed_invoice_beta_1", name: "School Program Package", qty: 1, priceCents: 5_500_000, amountCents: 5_500_000 }
  ] as const;
  for (const item of items) {
    await prisma.invoiceItem.upsert({ where: { id: item.id }, create: item, update: item });
  }

  const milestones = [
    { id: "seed_milestone_full_1", orgId: "seed_org_alpha", invoiceId: "seed_invoice_1", type: PaymentMilestoneType.FULL, amountCents: 3_500_000, status: "PENDING", paidAt: null },
    { id: "seed_milestone_dp_2", orgId: "seed_org_alpha", invoiceId: "seed_invoice_2", type: PaymentMilestoneType.DP, amountCents: 3_000_000, status: "PAID", paidAt: toDate("2026-03-06T13:30:00.000Z") },
    { id: "seed_milestone_final_2", orgId: "seed_org_alpha", invoiceId: "seed_invoice_2", type: PaymentMilestoneType.FINAL, amountCents: 5_000_000, status: "PENDING", paidAt: null },
    { id: "seed_milestone_full_3", orgId: "seed_org_alpha", invoiceId: "seed_invoice_3", type: PaymentMilestoneType.FULL, amountCents: 1_200_000, status: "PENDING", paidAt: null },
    { id: "seed_milestone_full_4", orgId: "seed_org_alpha", invoiceId: "seed_invoice_4", type: PaymentMilestoneType.FULL, amountCents: 2_700_000, status: "PAID", paidAt: toDate("2026-03-05T12:00:00.000Z") },
    { id: "seed_milestone_full_5", orgId: "seed_org_alpha", invoiceId: "seed_invoice_5", type: PaymentMilestoneType.FULL, amountCents: 900_000, status: "PENDING", paidAt: null },
    { id: "seed_milestone_full_beta_1", orgId: "seed_org_beta", invoiceId: "seed_invoice_beta_1", type: PaymentMilestoneType.FULL, amountCents: 5_500_000, status: "PENDING", paidAt: null }
  ] as const;
  for (const milestone of milestones) {
    await prisma.paymentMilestone.upsert({ where: { id: milestone.id }, create: milestone, update: milestone });
  }

  await prisma.paymentProof.upsert({
    where: { id: "seed_proof_1" },
    create: { id: "seed_proof_1", orgId: "seed_org_alpha", invoiceId: "seed_invoice_2", milestoneType: PaymentMilestoneType.DP, messageId: "seed_msg_3", mediaUrl: "https://example.com/proof-transfer.pdf", mimeType: "application/pdf", fileSize: 125_000, createdByUserId: "seed_user_cs" },
    update: { milestoneType: PaymentMilestoneType.DP, messageId: "seed_msg_3", mediaUrl: "https://example.com/proof-transfer.pdf", mimeType: "application/pdf", fileSize: 125_000 }
  });

  const auditLogs = [
    { id: "seed_audit_invoice_sent_1", orgId: "seed_org_alpha", actorUserId: "seed_user_admin", action: "invoice.sent", entityType: "invoice", entityId: "seed_invoice_1", metaJson: JSON.stringify({ channel: "whatsapp", by: "seed" }) },
    { id: "seed_audit_conversation_assigned", orgId: "seed_org_alpha", actorUserId: "seed_user_admin", action: "conversation.assigned", entityType: "conversation", entityId: "seed_conversation_1", metaJson: JSON.stringify({ assignee: "seed_member_cs" }) },
    { id: "seed_audit_proof_attached", orgId: "seed_org_alpha", actorUserId: "seed_user_cs", action: "invoice.proof_attached", entityType: "invoice", entityId: "seed_invoice_2", metaJson: JSON.stringify({ proofId: "seed_proof_1", milestoneType: "DP" }) },
    { id: "seed_audit_invoice_paid", orgId: "seed_org_alpha", actorUserId: "seed_user_owner", action: "invoice.mark_paid", entityType: "invoice", entityId: "seed_invoice_4", metaJson: JSON.stringify({ milestoneType: "FULL", source: "manual" }) }
  ] as const;
  for (const log of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      create: { ...log, createdAt: toDate("2026-03-06T13:20:00.000Z") },
      update: { action: log.action, entityType: log.entityType, entityId: log.entityId, metaJson: log.metaJson }
    });
  }

  const catalog = [
    { id: "seed_catalog_1", orgId: "seed_org_alpha", name: "Social Media Management", category: "Marketing", unit: "project", priceCents: 2_500_000, currency: "IDR", attachmentType: "link", attachmentUrl: "https://example.com/catalog/social-media" },
    { id: "seed_catalog_2", orgId: "seed_org_alpha", name: "Product Launch Event", category: "Event", unit: "event", priceCents: 6_500_000, currency: "IDR", attachmentType: "pdf", attachmentUrl: "https://example.com/catalog/launch-event.pdf" }
  ] as const;
  for (const item of catalog) {
    await prisma.serviceCatalogItem.upsert({
      where: { id: item.id },
      create: item,
      update: { name: item.name, category: item.category, unit: item.unit, priceCents: item.priceCents, currency: item.currency, attachmentType: item.attachmentType, attachmentUrl: item.attachmentUrl }
    });
  }
}
