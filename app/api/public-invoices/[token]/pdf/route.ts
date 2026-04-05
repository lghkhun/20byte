import { type NextRequest, NextResponse } from "next/server";

import { buildPublicInvoicePdfBuffer } from "@/server/services/publicInvoicePdfService";
import { getPublicInvoiceByToken } from "@/server/services/publicInvoiceService";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{token: string;}> }
) {
  const token = (await context.params).token?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_PUBLIC_TOKEN",
          message: "Public token is required."
        }
      },
      { status: 400 }
    );
  }

  const invoice = await getPublicInvoiceByToken(token);
  if (!invoice) {
    return NextResponse.json(
      {
        error: {
          code: "INVOICE_NOT_FOUND",
          message: "Invoice does not exist."
        }
      },
      { status: 404 }
    );
  }

  const pdfBuffer = await buildPublicInvoicePdfBuffer(invoice);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
