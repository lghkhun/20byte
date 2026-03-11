import { type PaymentMilestoneType, ProofType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { canAccessInbox } from "@/lib/permissions/orgPermissions";
import { publishProofAttachedEvent } from "@/lib/ably/publisher";
import { ServiceError } from "@/server/services/serviceError";

type AttachPaymentProofInput = {
  actorUserId: string;
  orgId: string;
  invoiceId: string;
  messageId: string;
  milestoneType?: PaymentMilestoneType;
};

type AttachPaymentProofResult = {
  id: string;
  invoiceId: string;
  milestoneType: PaymentMilestoneType | null;
  messageId: string | null;
  mediaUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date;
};

const MAX_PROOFS_PER_INVOICE = 5;

function normalize(value: string): string {
  return value.trim();
}

async function requireProofAccess(actorUserId: string, orgId: string): Promise<void> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: actorUserId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new ServiceError(403, "ORG_ACCESS_DENIED", "You do not have access to this organization.");
  }

  if (!canAccessInbox(membership.role)) {
    throw new ServiceError(403, "FORBIDDEN_INVOICE_ACCESS", "Your role cannot attach payment proof.");
  }
}

export async function attachPaymentProofFromMessage(input: AttachPaymentProofInput): Promise<AttachPaymentProofResult> {
  const orgId = normalize(input.orgId);
  const invoiceId = normalize(input.invoiceId);
  const messageId = normalize(input.messageId);
  if (!orgId) {
    throw new ServiceError(400, "MISSING_ORG_ID", "orgId is required.");
  }

  if (!invoiceId) {
    throw new ServiceError(400, "MISSING_INVOICE_ID", "invoiceId is required.");
  }

  if (!messageId) {
    throw new ServiceError(400, "MISSING_MESSAGE_ID", "messageId is required.");
  }

  await requireProofAccess(input.actorUserId, orgId);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      orgId
    },
    select: {
      id: true
    }
  });

  if (!invoice) {
    throw new ServiceError(404, "INVOICE_NOT_FOUND", "Invoice does not exist.");
  }

  const existingProofCount = await prisma.paymentProof.count({
    where: {
      orgId,
      invoiceId: invoice.id
    }
  });
  if (existingProofCount >= MAX_PROOFS_PER_INVOICE) {
    throw new ServiceError(400, "PROOF_LIMIT_EXCEEDED", "Maximum 5 payment proofs allowed per invoice.");
  }

  if (input.milestoneType) {
    const milestone = await prisma.paymentMilestone.findFirst({
      where: {
        orgId,
        invoiceId: invoice.id,
        type: input.milestoneType
      },
      select: {
        id: true
      }
    });

    if (!milestone) {
      throw new ServiceError(400, "INVALID_MILESTONE_TYPE", "Milestone type does not exist on this invoice.");
    }
  }

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      orgId
    },
    select: {
      id: true,
      type: true,
      mediaUrl: true,
      mimeType: true,
      fileSize: true
    }
  });

  if (!message) {
    throw new ServiceError(404, "MESSAGE_NOT_FOUND", "Message does not exist.");
  }

  if (message.type !== "IMAGE" && message.type !== "DOCUMENT") {
    throw new ServiceError(400, "INVALID_PROOF_MESSAGE_TYPE", "Payment proof must come from image or document message.");
  }

  if (message.type === "DOCUMENT" && message.mimeType?.toLowerCase().trim() !== "application/pdf") {
    throw new ServiceError(400, "INVALID_PROOF_DOCUMENT_TYPE", "Payment proof document must be PDF.");
  }

  if (!message.mediaUrl) {
    throw new ServiceError(400, "MESSAGE_MEDIA_NOT_READY", "Message media URL is not available yet.");
  }

  const proof = await prisma.paymentProof.create({
    data: {
      orgId,
      invoiceId: invoice.id,
      milestoneType: input.milestoneType ?? null,
      type: ProofType.TRANSFER,
      messageId: message.id,
      mediaUrl: message.mediaUrl,
      mimeType: message.mimeType,
      fileSize: message.fileSize ?? null,
      createdByUserId: input.actorUserId
    },
    select: {
      id: true,
      invoiceId: true,
      milestoneType: true,
      messageId: true,
      mediaUrl: true,
      mimeType: true,
      fileSize: true,
      createdAt: true
    }
  });

  void publishProofAttachedEvent({
    orgId,
    invoiceId: invoice.id,
    proofId: proof.id
  });

  return proof;
}
