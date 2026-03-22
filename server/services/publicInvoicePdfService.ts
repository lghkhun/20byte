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

function resolveAssetUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${trimmed}`;
}

async function loadImageBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) {
    return null;
  }

  try {
    const resolvedUrl = resolveAssetUrl(url);
    if (!resolvedUrl) {
      return null;
    }

    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return null;
    }

    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
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

    void (async () => {
      const customerName = invoice.customerName?.trim() || invoice.customerPhoneE164;
      const paidTotalCents = Math.min(
        invoice.totalCents,
        invoice.milestones
          .filter((milestone) => milestone.status === "PAID")
          .reduce((accumulator, milestone) => accumulator + milestone.amountCents, 0)
      );
      const remainingCents = Math.max(invoice.totalCents - paidTotalCents, 0);
      const discountTotalCents = invoice.lineDiscountCents + invoice.invoiceDiscountCents;
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

      function drawItemTableHeader() {
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
          doc.text(column.label, cursor, y + 7, {
            width: column.width - 12,
            align: column.align
          });
          cursor += column.width;
        }

        doc.font("Helvetica");
        doc.y = y + 24;

        return columns;
      }

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

      let columns = drawItemTableHeader();
      for (const item of invoice.items) {
      const rowHeight = item.description ? 36 : 24;
      ensureSpace(rowHeight + 2);
      if (doc.y + rowHeight > bottom - 120) {
        doc.addPage();
        doc.moveDown(0.2);
        columns = drawItemTableHeader();
      }

      const y = doc.y;
      let cursor = left + 6;

      doc
        .save()
        .rect(left, y, tableWidth, rowHeight)
        .strokeColor("#e2e8f0")
        .lineWidth(0.6)
        .stroke()
        .restore();

      doc.fontSize(9).fillColor("#0f172a").font("Helvetica-Bold");
      doc.text(item.name, cursor, y + 6, {
        width: columns[0].width - 12,
        align: "left"
      });
      if (item.description) {
        doc.font("Helvetica").fontSize(8).fillColor("#64748b");
        doc.text(item.description, cursor, y + 18, {
          width: columns[0].width - 12,
          align: "left"
        });
      }
      cursor += columns[0].width;

      doc.font("Helvetica").fontSize(9).fillColor("#0f172a");
      const qtyText = `${item.qty}${item.unit ? ` ${item.unit}` : ""}`;
      doc.text(qtyText, cursor, y + 6, { width: columns[1].width - 12, align: "right" });
      cursor += columns[1].width;
      doc.text(formatMoney(item.priceCents, invoice.currency), cursor, y + 6, { width: columns[2].width - 12, align: "right" });
      cursor += columns[2].width;
      doc.text(formatMoney(item.subtotalCents, invoice.currency), cursor, y + 6, { width: columns[3].width - 12, align: "right" });
      cursor += columns[3].width;
      doc.text(formatMoney(item.discountCents, invoice.currency), cursor, y + 6, { width: columns[4].width - 12, align: "right" });
      cursor += columns[4].width;
      doc.text(formatMoney(item.taxCents, invoice.currency), cursor, y + 6, { width: columns[5].width - 12, align: "right" });
      cursor += columns[5].width;
      doc.font("Helvetica-Bold");
      doc.text(formatMoney(item.amountCents, invoice.currency), cursor, y + 6, { width: columns[6].width - 12, align: "right" });
      doc.font("Helvetica");

      doc.y = y + rowHeight + 2;
    }

      doc.moveDown(0.6);
      ensureSpace(150);
      const summaryStartY = doc.y;
      const summaryBoxWidth = 270;
      const summaryX = right - summaryBoxWidth;
      const summaryRows: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: "Subtotal", value: formatMoney(invoice.subtotalCents, invoice.currency) },
      { label: "Diskon Total", value: formatMoney(discountTotalCents, invoice.currency) },
      { label: "Pajak", value: formatMoney(invoice.taxCents, invoice.currency) },
      { label: "Total", value: formatMoney(invoice.totalCents, invoice.currency), bold: true },
      { label: "Total Terbayar", value: formatMoney(paidTotalCents, invoice.currency) },
      { label: "Sisa Tagihan", value: formatMoney(remainingCents, invoice.currency), bold: true }
    ];

      doc
        .save()
        .rect(summaryX, summaryStartY, summaryBoxWidth, 18 * summaryRows.length + 10)
        .fillAndStroke("#f8fafc", "#e2e8f0")
        .restore();

      let rowY = summaryStartY + 6;
      for (const row of summaryRows) {
        doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fillColor("#0f172a").fontSize(9);
        doc.text(row.label, summaryX + 8, rowY, { width: 150, align: "left" });
        doc.text(row.value, summaryX + 160, rowY, { width: summaryBoxWidth - 168, align: "right" });
        rowY += 18;
      }

      doc.y = Math.max(doc.y, summaryStartY + 18 * summaryRows.length + 16);

      doc.moveDown(0.8);
      doc.fontSize(12).fillColor("#0f172a").text("Keterangan");
      doc.fontSize(10).fillColor("#334155").text(invoice.notes?.trim() || "-");
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor("#0f172a").text("Syarat dan Ketentuan");
      doc.fontSize(10).fillColor("#334155").text(invoice.terms?.trim() || "-");

      const signatureImage = await loadImageBuffer(invoice.orgSignatureUrl);
      const signatureBlockTop = doc.y + 12;
      const signatureBlockWidth = 220;
      const signatureX = right - signatureBlockWidth;
      const signatureDateY = signatureBlockTop;
      doc.fontSize(10).fillColor("#334155").text(formatDate(invoice.createdAt), signatureX, signatureDateY, {
        width: signatureBlockWidth,
        align: "right"
      });
      if (signatureImage) {
        doc.image(signatureImage, signatureX + 58, signatureDateY + 14, {
          fit: [150, 64],
          align: "right"
        });
      }
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(invoice.orgResponsibleName ?? invoice.orgName, signatureX, signatureDateY + 84, {
        width: signatureBlockWidth,
        align: "right"
      });

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
    })().catch((error) => {
      reject(error);
    });
  });
}
