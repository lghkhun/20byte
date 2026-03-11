import PDFDocument from "pdfkit";

import { buildInvoicePdfObjectKey } from "@/lib/storage/mediaObjectKey";
import { uploadToR2 } from "@/lib/r2/client";

type InvoicePdfItem = {
  name: string;
  qty: number;
  unit: string | null;
  priceCents: number;
  amountCents: number;
};

type InvoicePdfMilestone = {
  type: string;
  amountCents: number;
  dueDate: Date | null;
  status: string;
};

type InvoicePdfBankAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

type GenerateInvoicePdfInput = {
  orgId: string;
  invoiceId: string;
  invoiceNo: string;
  status: string;
  customerName: string | null;
  customerPhoneE164: string;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  dueDate: Date | null;
  items: InvoicePdfItem[];
  milestones: InvoicePdfMilestone[];
  bankAccounts: InvoicePdfBankAccount[];
};

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function buildInvoicePdfBuffer(input: GenerateInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 48
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    doc.fontSize(20).text("20byte Invoice");
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Invoice No: ${input.invoiceNo}`);
    doc.text(`Status: ${input.status}`);
    doc.text(`Customer: ${input.customerName ?? input.customerPhoneE164}`);
    doc.text(`Phone: ${input.customerPhoneE164}`);
    doc.text(`Due Date: ${formatDate(input.dueDate)}`);
    doc.moveDown(1);

    doc.fontSize(13).text("Items");
    doc.moveDown(0.3);
    for (const item of input.items) {
      const qtyPart = `${item.qty}${item.unit ? ` ${item.unit}` : ""}`;
      doc.fontSize(10).text(
        `- ${item.name} | ${qtyPart} x ${formatRupiah(item.priceCents)} = ${formatRupiah(item.amountCents)}`
      );
    }

    doc.moveDown(1);
    doc.fontSize(13).text("Milestones");
    doc.moveDown(0.3);
    for (const milestone of input.milestones) {
      doc
        .fontSize(10)
        .text(
          `- ${milestone.type}: ${formatRupiah(milestone.amountCents)} | Due ${formatDate(milestone.dueDate)} | ${milestone.status}`
        );
    }

    doc.moveDown(1);
    doc.fontSize(13).text("Payment Instructions");
    doc.moveDown(0.3);
    if (input.bankAccounts.length === 0) {
      doc.fontSize(10).text("No bank account configured.");
    } else {
      for (const account of input.bankAccounts) {
        doc
          .fontSize(10)
          .text(`- ${account.bankName} | ${account.accountNumber} | ${account.accountHolder}`);
      }
    }

    doc.moveDown(1);
    doc.fontSize(11).text(`Subtotal: ${formatRupiah(input.subtotalCents)}`);
    doc.fontSize(12).text(`Total: ${formatRupiah(input.totalCents)}`);
    doc.end();
  });
}

export async function generateAndUploadInvoicePdf(input: GenerateInvoicePdfInput): Promise<string> {
  const pdfBuffer = await buildInvoicePdfBuffer(input);
  const objectKey = buildInvoicePdfObjectKey({
    orgId: input.orgId,
    invoiceId: input.invoiceId
  });

  return uploadToR2({
    objectKey,
    body: pdfBuffer,
    contentType: "application/pdf"
  });
}

