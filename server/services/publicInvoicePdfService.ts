import PDFDocument from "pdfkit";

import type { PublicInvoiceDetail } from "@/server/services/publicInvoiceService";

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amountCents / 100);
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

export function buildPublicInvoicePdfBuffer(invoice: PublicInvoiceDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const customerName = invoice.customerName?.trim() || invoice.customerPhoneE164;

    doc.fontSize(22).text(invoice.orgName);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#64748b").text(`Invoice: ${invoice.invoiceNo}`);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Tanggal dibuat: ${formatDate(invoice.createdAt)}`);
    doc.text(`Jatuh tempo: ${formatDate(invoice.dueDate)}`);

    doc.moveDown(0.8);
    doc.fillColor("#0f172a").fontSize(11).text("Ditagihkan kepada");
    doc.fontSize(10).fillColor("#334155").text(customerName);
    doc.text(invoice.customerPhoneE164);

    doc.moveDown(1);
    doc.fillColor("#0f172a").fontSize(12).text("Item Invoice");
    doc.moveDown(0.4);

    for (const item of invoice.items) {
      const qtyText = `${item.qty}${item.unit ? ` ${item.unit}` : ""}`;
      doc
        .fontSize(10)
        .fillColor("#0f172a")
        .text(item.name, { continued: true })
        .fillColor("#64748b")
        .text(`  •  ${qtyText} x ${formatMoney(item.priceCents, invoice.currency)}`);
      if (item.description) {
        doc.fontSize(9).fillColor("#64748b").text(item.description);
      }
      doc.fontSize(10).fillColor("#0f172a").text(`Subtotal item: ${formatMoney(item.amountCents, invoice.currency)}`);
      doc.moveDown(0.35);
    }

    doc.moveDown(0.6);
    doc.fontSize(11).fillColor("#0f172a").text(`Subtotal: ${formatMoney(invoice.subtotalCents, invoice.currency)}`);
    doc.fontSize(13).text(`Total: ${formatMoney(invoice.totalCents, invoice.currency)}`);

    doc.moveDown(1);
    doc.fontSize(12).text("Instruksi Pembayaran");
    if (invoice.bankAccounts.length === 0) {
      doc.fontSize(10).fillColor("#64748b").text("Belum ada rekening yang dikonfigurasi.");
    } else {
      for (const account of invoice.bankAccounts) {
        doc
          .fontSize(10)
          .fillColor("#0f172a")
          .text(`${account.bankName} - ${account.accountNumber}`)
          .fillColor("#64748b")
          .text(`a.n. ${account.accountHolder}`);
      }
    }

    doc.end();
  });
}
