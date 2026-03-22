import PDFDocument from "pdfkit";

import { buildInvoicePdfObjectKey } from "@/lib/storage/mediaObjectKey";
import { uploadToR2 } from "@/lib/r2/client";

type InvoicePdfItem = {
  name: string;
  qty: number;
  unit: string | null;
  priceCents: number;
  subtotalCents: number;
  discountCents: number;
  taxLabel: string | null;
  taxCents: number;
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
  grossSubtotalCents?: number;
  lineDiscountCents?: number;
  invoiceDiscountType?: string;
  invoiceDiscountValue?: number;
  invoiceDiscountCents?: number;
  taxCents?: number;
  subtotalCents: number;
  totalCents: number;
  notes: string | null;
  terms: string | null;
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
    const left = 48;
    const right = doc.page.width - 48;
    const bottom = doc.page.height - 56;
    const tableWidth = right - left;

    function ensureSpace(heightNeeded: number) {
      if (doc.y + heightNeeded <= bottom) {
        return;
      }
      doc.addPage();
    }

    function drawItemsHeader() {
      const y = doc.y;
      const columns = [
        { label: "Produk", width: tableWidth * 0.33, align: "left" as const },
        { label: "Qty", width: tableWidth * 0.1, align: "right" as const },
        { label: "Harga", width: tableWidth * 0.13, align: "right" as const },
        { label: "Subtotal", width: tableWidth * 0.13, align: "right" as const },
        { label: "Diskon", width: tableWidth * 0.09, align: "right" as const },
        { label: "Pajak", width: tableWidth * 0.09, align: "right" as const },
        { label: "Jumlah", width: tableWidth * 0.13, align: "right" as const }
      ];

      doc
        .save()
        .rect(left, y, tableWidth, 22)
        .fill("#1e293b")
        .restore();

      let cursor = left + 6;
      doc.fillColor("#f8fafc").fontSize(9).font("Helvetica-Bold");
      for (const column of columns) {
        doc.text(column.label, cursor, y + 7, { width: column.width - 12, align: column.align });
        cursor += column.width;
      }
      doc.font("Helvetica");
      doc.y = y + 24;

      return columns;
    }

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
    let columns = drawItemsHeader();
    for (const item of input.items) {
      ensureSpace(28);
      if (doc.y > bottom - 120) {
        doc.addPage();
        columns = drawItemsHeader();
      }
      const y = doc.y;
      let cursor = left + 6;
      doc
        .save()
        .rect(left, y, tableWidth, 24)
        .strokeColor("#e2e8f0")
        .lineWidth(0.6)
        .stroke()
        .restore();

      const qtyPart = `${item.qty}${item.unit ? ` ${item.unit}` : ""}`;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a");
      doc.text(item.name, cursor, y + 7, { width: columns[0].width - 12, align: "left" });
      cursor += columns[0].width;
      doc.font("Helvetica").fontSize(9);
      doc.text(qtyPart, cursor, y + 7, { width: columns[1].width - 12, align: "right" });
      cursor += columns[1].width;
      doc.text(formatRupiah(item.priceCents), cursor, y + 7, { width: columns[2].width - 12, align: "right" });
      cursor += columns[2].width;
      doc.text(formatRupiah(item.subtotalCents), cursor, y + 7, { width: columns[3].width - 12, align: "right" });
      cursor += columns[3].width;
      doc.text(formatRupiah(item.discountCents), cursor, y + 7, { width: columns[4].width - 12, align: "right" });
      cursor += columns[4].width;
      doc.text(formatRupiah(item.taxCents), cursor, y + 7, { width: columns[5].width - 12, align: "right" });
      cursor += columns[5].width;
      doc.font("Helvetica-Bold");
      doc.text(formatRupiah(item.amountCents), cursor, y + 7, { width: columns[6].width - 12, align: "right" });
      doc.font("Helvetica").fillColor("#0f172a");
      doc.y = y + 26;
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
    doc.fontSize(11).fillColor("#0f172a").text(`Subtotal: ${formatRupiah(input.subtotalCents)}`);
    doc.fontSize(11).fillColor("#0f172a").text(`Diskon Total: ${formatRupiah((input.lineDiscountCents ?? 0) + (input.invoiceDiscountCents ?? 0))}`);
    doc.fontSize(11).fillColor("#0f172a").text(`Pajak: ${formatRupiah(input.taxCents ?? 0)}`);
    doc.fontSize(12).fillColor("#0f172a").text(`Total: ${formatRupiah(input.totalCents)}`);

    doc.moveDown(0.8);
    doc.fontSize(12).fillColor("#0f172a").text("Keterangan");
    doc.fontSize(10).fillColor("#334155").text(input.notes?.trim() || "-");
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#0f172a").text("Syarat dan Ketentuan");
    doc.fontSize(10).fillColor("#334155").text(input.terms?.trim() || "-");
    doc.end();
  });
}

export async function generateAndUploadInvoicePdf(input: GenerateInvoicePdfInput): Promise<string | null> {
  try {
    const pdfBuffer = await buildInvoicePdfBuffer(input);
    const objectKey = buildInvoicePdfObjectKey({
      orgId: input.orgId,
      invoiceId: input.invoiceId
    });

    return await uploadToR2({
      objectKey,
      body: pdfBuffer,
      contentType: "application/pdf"
    });
  } catch {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }

    throw new Error("Failed to upload invoice PDF.");
  }
}
