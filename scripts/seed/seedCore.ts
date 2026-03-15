import bcrypt from "bcryptjs";
import {
  ConversationStatus,
  MessageDirection,
  MessageSendStatus,
  MessageType,
  Role,
  WaTemplateCategory
} from "@prisma/client";

import { toDate, type SeedContext } from "@/scripts/seed/types";

export async function seedCore(ctx: SeedContext) {
  const { prisma, demoPassword } = ctx;
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const users = [
    { id: "seed_user_owner", email: "owner@seed.20byte.local", name: "Seed Owner" },
    { id: "seed_user_admin", email: "admin@seed.20byte.local", name: "Seed Admin" },
    { id: "seed_user_cs", email: "cs@seed.20byte.local", name: "Seed CS" },
    { id: "seed_user_adv", email: "advertiser@seed.20byte.local", name: "Seed Advertiser" },
    { id: "seed_user_owner_org_b", email: "owner-b@seed.20byte.local", name: "Seed Owner Org B" }
  ] as const;
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash },
      update: { name: user.name, passwordHash }
    });
  }

  await prisma.org.upsert({
    where: { id: "seed_org_alpha" },
    create: { id: "seed_org_alpha", name: "Seed Org Alpha", walletBalanceCents: 25_000_00 },
    update: { name: "Seed Org Alpha", walletBalanceCents: 25_000_00 }
  });
  await prisma.org.upsert({
    where: { id: "seed_org_beta" },
    create: { id: "seed_org_beta", name: "Seed Org Beta", walletBalanceCents: 10_000_00 },
    update: { name: "Seed Org Beta", walletBalanceCents: 10_000_00 }
  });

  const memberships = [
    { id: "seed_member_owner", orgId: "seed_org_alpha", email: "owner@seed.20byte.local", role: Role.OWNER },
    { id: "seed_member_admin", orgId: "seed_org_alpha", email: "admin@seed.20byte.local", role: Role.ADMIN },
    { id: "seed_member_cs", orgId: "seed_org_alpha", email: "cs@seed.20byte.local", role: Role.CS },
    { id: "seed_member_adv", orgId: "seed_org_alpha", email: "advertiser@seed.20byte.local", role: Role.ADVERTISER },
    { id: "seed_member_owner_b", orgId: "seed_org_beta", email: "owner-b@seed.20byte.local", role: Role.OWNER },
    { id: "seed_member_cs_b", orgId: "seed_org_beta", email: "cs@seed.20byte.local", role: Role.CS }
  ] as const;
  for (const item of memberships) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: item.email }, select: { id: true } });
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: item.orgId, userId: user.id } },
      create: { id: item.id, orgId: item.orgId, userId: user.id, role: item.role },
      update: { role: item.role }
    });
  }

  await prisma.orgPlan.upsert({
    where: { orgId: "seed_org_alpha" },
    create: { orgId: "seed_org_alpha", planKey: "growth", seatLimit: 10, storageQuotaMb: 2048, retentionDays: 180 },
    update: { planKey: "growth", seatLimit: 10, storageQuotaMb: 2048, retentionDays: 180 }
  });
  await prisma.orgPlan.upsert({
    where: { orgId: "seed_org_beta" },
    create: { orgId: "seed_org_beta", planKey: "starter", seatLimit: 3, storageQuotaMb: 512, retentionDays: 90 },
    update: { planKey: "starter", seatLimit: 3, storageQuotaMb: 512, retentionDays: 90 }
  });

  const bankAccounts = [
    { id: "seed_bank_alpha_1", orgId: "seed_org_alpha", bankName: "BCA", accountNumber: "1234567890", accountHolder: "20byte Studio" },
    { id: "seed_bank_alpha_2", orgId: "seed_org_alpha", bankName: "Mandiri", accountNumber: "9988776655", accountHolder: "20byte Studio" },
    { id: "seed_bank_alpha_3", orgId: "seed_org_alpha", bankName: "BRI", accountNumber: "5544332211", accountHolder: "20byte Studio" },
    { id: "seed_bank_alpha_4", orgId: "seed_org_alpha", bankName: "BNI", accountNumber: "1100220033", accountHolder: "20byte Studio" },
    { id: "seed_bank_alpha_5", orgId: "seed_org_alpha", bankName: "CIMB", accountNumber: "7766554433", accountHolder: "20byte Studio" },
    { id: "seed_bank_beta_1", orgId: "seed_org_beta", bankName: "BRI", accountNumber: "1122334455", accountHolder: "20byte Beta" }
  ] as const;
  for (const bank of bankAccounts) {
    await prisma.orgBankAccount.upsert({
      where: { id: bank.id },
      create: bank,
      update: { bankName: bank.bankName, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder }
    });
  }

  await prisma.waAccount.deleteMany({
    where: {
      orgId: {
        in: ["seed_org_alpha", "seed_org_beta"]
      }
    }
  });

  const shortlinks = [
    { id: "seed_shortlink_1", orgId: "seed_org_alpha", code: "SEEDMETA01", destinationUrl: "https://wa.me/628111000111?text=Halo%2020byte", source: "meta_ads", campaign: "ramadan-launch", adset: "lookalike-01", adName: "video-ad-01", platform: "facebook", medium: "ctwa", isEnabled: true, disabledAt: null },
    { id: "seed_shortlink_2", orgId: "seed_org_alpha", code: "SEEDMETA02", destinationUrl: "https://wa.me/628111000111?text=Halo%20Promo", source: "meta_ads", campaign: "promo-q2", adset: "retargeting-02", adName: "image-ad-02", platform: "instagram", medium: "ctwa", isEnabled: false, disabledAt: toDate("2026-03-03T10:00:00.000Z") }
  ] as const;
  for (const shortlink of shortlinks) {
    await prisma.shortlink.upsert({
      where: { code: shortlink.code },
      create: shortlink,
      update: { destinationUrl: shortlink.destinationUrl, source: shortlink.source, campaign: shortlink.campaign, adset: shortlink.adset, adName: shortlink.adName, platform: shortlink.platform, medium: shortlink.medium, isEnabled: shortlink.isEnabled, disabledAt: shortlink.disabledAt }
    });
  }

  const clicks = [
    { id: "seed_shortlink_click_1", orgId: "seed_org_alpha", shortlinkId: "seed_shortlink_1", ipHash: "seed-ip-hash-1", userAgent: "Mozilla/5.0 Seed Browser" },
    { id: "seed_shortlink_click_2", orgId: "seed_org_alpha", shortlinkId: "seed_shortlink_1", ipHash: "seed-ip-hash-2", userAgent: "Mozilla/5.0 Seed Browser Mobile" }
  ] as const;
  for (const click of clicks) {
    await prisma.shortlinkClick.upsert({ where: { id: click.id }, create: click, update: { ipHash: click.ipHash, userAgent: click.userAgent } });
  }

  const customers = [
    { id: "seed_customer_1", orgId: "seed_org_alpha", phoneE164: "+628111000111", displayName: "Dina Catering", source: "meta_ads", campaign: "ramadan-launch", adset: "lookalike-01", ad: "video-ad-01", platform: "facebook", medium: "ctwa" },
    { id: "seed_customer_2", orgId: "seed_org_alpha", phoneE164: "+628111000222", displayName: "Rama Wedding", source: "organic", campaign: null, adset: null, ad: null, platform: "whatsapp", medium: "direct" },
    { id: "seed_customer_3", orgId: "seed_org_alpha", phoneE164: "+628111000333", displayName: "Salsa Agency", source: "meta_ads", campaign: "agency-q1", adset: "retargeting", ad: "carousel-02", platform: "instagram", medium: "ctwa" },
    { id: "seed_customer_4", orgId: "seed_org_beta", phoneE164: "+628111000444", displayName: "Bimo School", source: "organic", campaign: null, adset: null, ad: null, platform: "whatsapp", medium: "direct" }
  ] as const;
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { orgId_phoneE164: { orgId: customer.orgId, phoneE164: customer.phoneE164 } },
      create: { ...customer, firstContactAt: toDate("2026-03-01T08:00:00.000Z") },
      update: { ...customer, firstContactAt: toDate("2026-03-01T08:00:00.000Z") }
    });
  }

  const conversations = [
    { id: "seed_conversation_1", orgId: "seed_org_alpha", customerId: "seed_customer_1", status: ConversationStatus.OPEN, assignedToMemberId: "seed_member_cs", sourceCampaign: "ramadan-launch", sourcePlatform: "facebook", sourceMedium: "ctwa", shortlinkId: "seed_shortlink_1", unreadCount: 1 },
    { id: "seed_conversation_2", orgId: "seed_org_alpha", customerId: "seed_customer_2", status: ConversationStatus.CLOSED, assignedToMemberId: "seed_member_admin", sourceCampaign: null, sourcePlatform: "whatsapp", sourceMedium: "direct", shortlinkId: null, unreadCount: 0 },
    { id: "seed_conversation_3", orgId: "seed_org_beta", customerId: "seed_customer_4", status: ConversationStatus.OPEN, assignedToMemberId: "seed_member_cs_b", sourceCampaign: null, sourcePlatform: "whatsapp", sourceMedium: "direct", shortlinkId: null, unreadCount: 2 },
    { id: "seed_conversation_4", orgId: "seed_org_alpha", customerId: "seed_customer_3", status: ConversationStatus.OPEN, assignedToMemberId: null, sourceCampaign: "agency-q1", sourcePlatform: "instagram", sourceMedium: "ctwa", shortlinkId: "seed_shortlink_1", unreadCount: 3 }
  ] as const;
  for (const conversation of conversations) {
    await prisma.conversation.upsert({
      where: { id: conversation.id },
      create: { ...conversation, lastMessageAt: toDate("2026-03-06T14:00:00.000Z") },
      update: { ...conversation, lastMessageAt: toDate("2026-03-06T14:00:00.000Z") }
    });
  }

  const messages = [
    { id: "seed_msg_1", orgId: "seed_org_alpha", conversationId: "seed_conversation_1", waMessageId: "wamid.seed.1", direction: MessageDirection.INBOUND, type: MessageType.TEXT, text: "Halo kak, bisa kirim pricelist?", createdAt: toDate("2026-03-06T13:00:00.000Z") },
    { id: "seed_msg_2", orgId: "seed_org_alpha", conversationId: "seed_conversation_1", waMessageId: "wamid.seed.2", direction: MessageDirection.OUTBOUND, type: MessageType.TEXT, text: "Bisa, aku kirim invoice draft dulu ya. [Automated]", sendStatus: MessageSendStatus.SENT, sendAttemptCount: 1, retryable: false, createdAt: toDate("2026-03-06T13:01:00.000Z") },
    { id: "seed_msg_3", orgId: "seed_org_alpha", conversationId: "seed_conversation_1", waMessageId: "wamid.seed.3", direction: MessageDirection.INBOUND, type: MessageType.DOCUMENT, mediaUrl: "https://example.com/proof-transfer.pdf", mimeType: "application/pdf", fileName: "proof-transfer.pdf", createdAt: toDate("2026-03-06T13:05:00.000Z") },
    { id: "seed_msg_4", orgId: "seed_org_alpha", conversationId: "seed_conversation_1", waMessageId: "wamid.seed.4", direction: MessageDirection.OUTBOUND, type: MessageType.TEMPLATE, text: "Invoice sudah dikirim, silakan cek link pembayaran. [Automated]", templateName: "invoice_followup_v1", templateCategory: WaTemplateCategory.UTILITY, templateLanguageCode: "id", templateComponentsJson: JSON.stringify([{ type: "body", parameters: [{ type: "text", text: "INV-2026-0001" }] }]), sendStatus: MessageSendStatus.SENT, sendAttemptCount: 1, retryable: false, createdAt: toDate("2026-03-06T13:06:00.000Z") },
    { id: "seed_msg_5", orgId: "seed_org_alpha", conversationId: "seed_conversation_2", waMessageId: "wamid.seed.5", direction: MessageDirection.OUTBOUND, type: MessageType.TEXT, text: "Pesanan sudah selesai, terima kasih. [Automated]", sendStatus: MessageSendStatus.FAILED, sendError: "Temporary WhatsApp API timeout", sendAttemptCount: 2, retryable: true, createdAt: toDate("2026-03-05T10:00:00.000Z") },
    { id: "seed_msg_6", orgId: "seed_org_alpha", conversationId: "seed_conversation_4", waMessageId: "wamid.seed.6", direction: MessageDirection.INBOUND, type: MessageType.IMAGE, mediaUrl: "https://picsum.photos/640/360", mimeType: "image/jpeg", fileName: "sample.jpg", fileSize: 128_000, createdAt: toDate("2026-03-06T13:10:00.000Z") },
    { id: "seed_msg_7", orgId: "seed_org_alpha", conversationId: "seed_conversation_4", waMessageId: "wamid.seed.7", direction: MessageDirection.INBOUND, type: MessageType.VIDEO, mediaUrl: "https://example.com/video-demo.mp4", mimeType: "video/mp4", fileName: "demo.mp4", fileSize: 1_250_000, durationSec: 32, createdAt: toDate("2026-03-06T13:11:00.000Z") },
    { id: "seed_msg_8", orgId: "seed_org_alpha", conversationId: "seed_conversation_4", waMessageId: "wamid.seed.8", direction: MessageDirection.INBOUND, type: MessageType.AUDIO, mediaUrl: "https://example.com/voice-note.mp3", mimeType: "audio/mpeg", fileName: "voice-note.mp3", fileSize: 64_000, durationSec: 11, createdAt: toDate("2026-03-06T13:12:00.000Z") },
    { id: "seed_msg_9", orgId: "seed_org_alpha", conversationId: "seed_conversation_4", waMessageId: "wamid.seed.9", direction: MessageDirection.OUTBOUND, type: MessageType.SYSTEM, text: "Auto-tag applied for CTWA campaign. [Automated]", isAutomated: true, createdAt: toDate("2026-03-06T13:13:00.000Z") },
    { id: "seed_msg_10", orgId: "seed_org_beta", conversationId: "seed_conversation_3", waMessageId: "wamid.seed.10", direction: MessageDirection.OUTBOUND, type: MessageType.TEXT, text: "Welcome to Seed Org Beta! [Automated]", isAutomated: true, sendStatus: MessageSendStatus.PENDING, sendAttemptCount: 1, retryable: true, createdAt: toDate("2026-03-06T10:30:00.000Z") }
  ] as const;
  for (const message of messages) {
    await prisma.message.upsert({ where: { id: message.id }, create: message, update: message });
  }
}
