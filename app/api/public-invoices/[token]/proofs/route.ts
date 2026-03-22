import { randomUUID } from "crypto";
import path from "path";
import { PaymentMilestoneType, ProofType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { uploadToR2 } from "@/lib/r2/client";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;
const MAX_PROOFS_PER_INVOICE = 5;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

function resolveExtension(file: File): string {
  const extension = path.extname(file.name).toLowerCase();
  if (extension === ".png" || extension === ".jpg" || extension === ".jpeg" || extension === ".pdf" || extension === ".webp") {
    if (extension === ".jpeg") {
      return ".jpg";
    }
    return extension;
  }

  if (file.type === "image/png") {
    return ".png";
  }
  if (file.type === "image/jpeg") {
    return ".jpg";
  }
  if (file.type === "image/webp") {
    return ".webp";
  }
  return ".pdf";
}

function parseMilestoneType(value: FormDataEntryValue | null): PaymentMilestoneType | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === PaymentMilestoneType.FULL) {
    return PaymentMilestoneType.FULL;
  }
  if (normalized === PaymentMilestoneType.DP) {
    return PaymentMilestoneType.DP;
  }
  if (normalized === PaymentMilestoneType.FINAL) {
    return PaymentMilestoneType.FINAL;
  }
  return null;
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      token: string;
    };
  }
) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "INVALID_FORM_DATA", "Request body must be multipart form data.");
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return errorResponse(400, "MISSING_FILE", "file is required.");
  }

  if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
    return errorResponse(400, "INVALID_FILE_TYPE", "Only PNG, JPG, WEBP, or PDF files are supported.");
  }
  if (fileEntry.size <= 0 || fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(400, "INVALID_FILE_SIZE", "File size must be between 1 byte and 6 MB.");
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: {
        publicToken: context.params.token
      },
      select: {
        id: true,
        orgId: true,
        status: true,
        milestones: {
          select: {
            type: true
          }
        },
        _count: {
          select: {
            proofs: true
          }
        }
      }
    });

    if (!invoice) {
      return errorResponse(404, "INVOICE_NOT_FOUND", "Invoice not found.");
    }
    if (invoice.status === "VOID") {
      return errorResponse(400, "INVOICE_VOID", "Void invoice cannot receive payment proof.");
    }
    if (invoice._count.proofs >= MAX_PROOFS_PER_INVOICE) {
      return errorResponse(400, "PROOF_LIMIT_EXCEEDED", "Maximum 5 payment proofs allowed per invoice.");
    }

    const milestoneType = parseMilestoneType(formData.get("milestoneType"));
    if (milestoneType) {
      const exists = invoice.milestones.some((milestone) => milestone.type === milestoneType);
      if (!exists) {
        return errorResponse(400, "INVALID_MILESTONE_TYPE", "Milestone type does not exist on this invoice.");
      }
    }

    const ownerMember = await prisma.orgMember.findFirst({
      where: {
        orgId: invoice.orgId
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        userId: true
      }
    });
    if (!ownerMember) {
      return errorResponse(500, "ORG_MEMBER_NOT_FOUND", "Organization member not found.");
    }

    const extension = resolveExtension(fileEntry);
    const objectKey = `org/${invoice.orgId}/invoice/${invoice.id}/public-proof-${randomUUID()}${extension}`;
    const body = Buffer.from(await fileEntry.arrayBuffer());
    const mediaUrl = await uploadToR2({
      objectKey,
      body,
      contentType: fileEntry.type
    });

    const proof = await prisma.paymentProof.create({
      data: {
        orgId: invoice.orgId,
        invoiceId: invoice.id,
        milestoneType,
        type: ProofType.TRANSFER,
        messageId: null,
        mediaUrl,
        mimeType: fileEntry.type,
        fileSize: fileEntry.size,
        createdByUserId: ownerMember.userId
      },
      select: {
        id: true,
        milestoneType: true,
        mediaUrl: true,
        mimeType: true,
        createdAt: true
      }
    });

    return NextResponse.json(
      {
        data: {
          proof
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch {
    return errorResponse(500, "PUBLIC_PROOF_UPLOAD_FAILED", "Failed to upload payment proof.");
  }
}
