import Image from "next/image";
import { notFound } from "next/navigation";

import { PublicInvoicePaymentInstructions } from "@/components/invoices/PublicInvoicePaymentInstructions";
import { PublicInvoiceToolbar } from "@/components/invoices/PublicInvoiceToolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPublicInvoiceByToken } from "@/server/services/publicInvoiceService";

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

function statusTone(status: string): "default" | "secondary" | "outline" {
  if (status === "PAID") {
    return "default";
  }

  if (status === "SENT" || status === "PARTIALLY_PAID") {
    return "secondary";
  }

  return "outline";
}

export default async function PublicInvoicePage({
  params
}: {
  params: {
    token: string;
  };
}) {
  const invoice = await getPublicInvoiceByToken(params.token);
  if (!invoice) {
    notFound();
  }

  const customerLabel = invoice.customerName?.trim() || invoice.customerPhoneE164;

  return (
    <main className="public-invoice-root mx-auto min-h-screen w-full max-w-[210mm] space-y-4 px-3 py-4 md:space-y-5 md:px-0 md:py-8">
      <Card className="public-invoice-sheet rounded-2xl border-border/70 shadow-sm">
        <CardContent className="space-y-5 p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Public Invoice</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{invoice.orgName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Invoice #{invoice.invoiceNo}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusTone(invoice.status)}>{invoice.status}</Badge>
            </div>
          </div>

          <Separator />

          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bill To</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{customerLabel}</p>
                <p className="text-sm text-muted-foreground">{invoice.customerPhoneE164}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Invoice Meta</p>
                <p className="mt-2 text-sm text-foreground">Created: {formatDate(invoice.createdAt)}</p>
                <p className="text-sm text-foreground">Due date: {formatDate(invoice.dueDate)}</p>
              </div>
            </div>
            <PublicInvoiceToolbar token={params.token} hasStoredPdf={Boolean(invoice.pdfUrl)} storedPdfUrl={invoice.pdfUrl} />
          </div>
        </CardContent>
      </Card>

      <Card className="public-invoice-section rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 pt-5 md:px-7">
            <h2 className="text-lg font-semibold text-foreground">Invoice Items</h2>
          </div>
          <div className="mt-4 overflow-x-auto rounded-b-2xl border-t border-border/70">
            <Table className="min-w-[640px] md:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                    </TableCell>
                    <TableCell>
                      {item.qty}
                      {item.unit ? ` ${item.unit}` : ""}
                    </TableCell>
                    <TableCell>{formatMoney(item.priceCents, invoice.currency)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(item.amountCents, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-5 pb-5 pt-4 md:px-7 md:pb-7">
            <div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(invoice.subtotalCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatMoney(invoice.totalCents, invoice.currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="public-invoice-section rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground">Milestones</h2>
            <div className="mt-3 space-y-2">
              {invoice.milestones.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada milestone.</p> : null}
              {invoice.milestones.map((milestone) => (
                <article key={milestone.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{milestone.type}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{formatMoney(milestone.amountCents, invoice.currency)}</p>
                  <p className="text-xs text-muted-foreground">Due {formatDate(milestone.dueDate)}</p>
                  <p className="text-xs text-muted-foreground">Status: {milestone.status}</p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="public-invoice-section rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground">Payment Proofs</h2>
            {invoice.proofs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Belum ada bukti pembayaran.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {invoice.proofs.map((proof) => {
                  const isImage = proof.mimeType?.startsWith("image/") ?? false;
                  return (
                    <article key={proof.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">
                        {proof.milestoneType ?? "-"} • {formatDate(proof.createdAt)}
                      </p>
                      {isImage ? (
                        <Image
                          src={proof.mediaUrl}
                          alt="Payment proof"
                          width={960}
                          height={540}
                          unoptimized
                          className="mt-2 h-auto w-full rounded-md border border-border/70 object-cover"
                        />
                      ) : (
                        <a
                          href={proof.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
                        >
                          Open proof file
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PublicInvoicePaymentInstructions
        accounts={invoice.bankAccounts}
        formattedTotal={formatMoney(invoice.totalCents, invoice.currency)}
      />
    </main>
  );
}
