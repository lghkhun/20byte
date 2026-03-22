import Image from "next/image";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import { PublicInvoicePaymentInstructions } from "@/components/invoices/PublicInvoicePaymentInstructions";
import { PublicInvoiceProofUploader } from "@/components/invoices/PublicInvoiceProofUploader";
import { PublicInvoiceToolbar } from "@/components/invoices/PublicInvoiceToolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    month: "2-digit",
    year: "numeric"
  }).format(value);
}

function milestoneTone(status: string): {
  nodeClassName: string;
  lineClassName: string;
  statusClassName: string;
} {
  if (status === "PAID") {
    return {
      nodeClassName: "border-emerald-300 bg-emerald-100",
      lineClassName: "bg-emerald-200",
      statusClassName: "text-emerald-700"
    };
  }
  if (status === "OVERDUE" || status === "VOID") {
    return {
      nodeClassName: "border-rose-300 bg-rose-100",
      lineClassName: "bg-rose-200",
      statusClassName: "text-rose-700"
    };
  }
  if (status === "PARTIALLY_PAID") {
    return {
      nodeClassName: "border-amber-300 bg-amber-100",
      lineClassName: "bg-amber-200",
      statusClassName: "text-amber-700"
    };
  }
  return {
    nodeClassName: "border-slate-300 bg-slate-100",
    lineClassName: "bg-slate-200",
    statusClassName: "text-slate-600"
  };
}

function MilestoneStatusIcon({ status }: { status: string }) {
  if (status === "PAID") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />;
  }
  if (status === "OVERDUE" || status === "VOID") {
    return <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />;
  }
  return <Clock3 className="h-3.5 w-3.5 text-slate-600" />;
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
  const primaryBankAccount = invoice.bankAccounts[0] ?? null;
  const itemDiscountTotalCents = invoice.lineDiscountCents;
  const taxTotalCents = invoice.taxCents;
  const paidTotalCents = Math.min(
    invoice.totalCents,
    invoice.milestones
      .filter((milestone) => milestone.status === "PAID")
      .reduce((accumulator, milestone) => accumulator + milestone.amountCents, 0)
  );
  const remainingCents = Math.max(invoice.totalCents - paidTotalCents, 0);

  return (
    <main className="public-invoice-root mx-auto min-h-screen w-full max-w-[1480px] space-y-4 overflow-x-hidden px-3 py-4 md:px-5 md:py-6">
      <div className="grid min-w-0 items-start justify-center gap-4 lg:grid-cols-[210mm_330px]">
        <Card className="public-invoice-sheet invoice-a4-sheet w-full min-w-0 rounded-md border-[#d4dde8] bg-white shadow-[0_6px_24px_rgba(15,23,42,0.08)]">
          <CardContent className="min-w-0 space-y-4 p-5 text-slate-700">
            <div className="flex items-center justify-between print:hidden">
              <p className="border-l-2 border-slate-400 pl-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Invoice Pembelian</p>
              <PublicInvoiceToolbar />
            </div>

            <div className="grid grid-cols-1 items-start gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
              <div className="min-w-0 sm:text-left">
                {invoice.orgLogoUrl ? (
                  <Image
                    src={invoice.orgLogoUrl}
                    alt={`${invoice.orgName} logo`}
                    width={180}
                    height={72}
                    unoptimized
                    className="mx-auto h-12 w-auto object-contain sm:mx-0"
                  />
                ) : (
                  <p className="text-center text-xl font-semibold text-slate-800 sm:text-left">{invoice.orgName}</p>
                )}
              </div>
              <div className="text-center sm:text-right">
                <p className="text-[42px] font-medium leading-none text-slate-800">Invoice</p>
                <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                  <p>Referensi: {invoice.invoiceNo}</p>
                  <p>Tgl. Invoice: {formatDate(invoice.createdAt)}</p>
                  <p>Tgl. Jatuh Tempo: {formatDate(invoice.dueDate)}</p>
                  <p>NPWP: {invoice.orgBusinessNpwp?.trim() || "-"}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="border-t border-slate-200 pt-2">
                <h3 className="text-sm font-semibold text-slate-900">Info Perusahaan</h3>
                <p className="mt-1.5 text-[13px] font-semibold text-slate-900">{invoice.orgName}</p>
                <p className="mt-0.5 text-xs text-slate-600">{invoice.orgResponsibleName ?? "-"}</p>
              </article>
              <article className="border-t border-slate-200 pt-2">
                <h3 className="text-sm font-semibold text-slate-900">Tagihan Untuk</h3>
                <p className="mt-1.5 text-[13px] font-semibold text-slate-900">{customerLabel}</p>
                <p className="mt-0.5 text-xs text-slate-600">{invoice.customerPhoneE164}</p>
              </article>
            </div>

            <div className="public-invoice-table-scroll w-full max-w-full overflow-x-auto rounded border border-slate-300 sm:overflow-visible">
              <Table className="min-w-[880px] text-[12px] sm:min-w-0">
                <colgroup>
                  <col style={{ width: "33%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-slate-800 hover:bg-slate-800">
                    <TableHead className="h-8 whitespace-nowrap text-slate-100">Produk</TableHead>
                    <TableHead className="h-8 whitespace-nowrap text-slate-100">Kuantitas</TableHead>
                    <TableHead className="h-8 whitespace-nowrap text-slate-100">Harga Satuan</TableHead>
                    <TableHead className="h-8 whitespace-nowrap text-slate-100">Subtotal</TableHead>
                    <TableHead className="h-8 whitespace-nowrap text-slate-100">Diskon</TableHead>
                    <TableHead className="h-8 whitespace-nowrap text-slate-100">Pajak</TableHead>
                    <TableHead className="h-8 whitespace-nowrap text-right text-slate-100">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => {
                    const lineSubtotalCents = item.subtotalCents;
                    const lineDiscountCents = item.discountCents;
                    const lineTaxCents = item.taxCents;

                    return (
                    <TableRow key={item.id} className="odd:bg-white even:bg-slate-50/45">
                      <TableCell className="py-2 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-[11px] text-slate-600">{item.description ?? "-"}</p>
                      </TableCell>
                      <TableCell className="py-2 whitespace-nowrap tabular-nums">
                        {item.qty}
                        {item.unit ? ` ${item.unit}` : ""}
                      </TableCell>
                      <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatMoney(item.priceCents, invoice.currency)}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatMoney(lineSubtotalCents, invoice.currency)}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatMoney(lineDiscountCents, invoice.currency)}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatMoney(lineTaxCents, invoice.currency)}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap text-right font-semibold tabular-nums text-slate-800">{formatMoney(item.amountCents, invoice.currency)}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="ml-auto w-full max-w-[360px] border-t border-slate-200 pt-2 text-sm">
              <div className="flex items-center justify-between border-b border-slate-200 py-2">
                <span>Subtotal</span>
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(invoice.subtotalCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 py-2">
                <span>Diskon Total</span>
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(itemDiscountTotalCents + invoice.invoiceDiscountCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 py-2">
                <span>Pajak</span>
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(taxTotalCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 py-2">
                <span>Total</span>
                <span className="font-semibold tabular-nums text-slate-900">{formatMoney(invoice.totalCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 py-2">
                <span>Total Terbayar</span>
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(paidTotalCents, invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Sisa Tagihan</span>
                <span className="font-semibold tabular-nums text-slate-900">{formatMoney(remainingCents, invoice.currency)}</span>
              </div>
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-[1fr_220px]">
              <div className="border-t border-slate-200 pt-2">
                <h3 className="text-lg font-semibold text-slate-900">Keterangan</h3>
                {invoice.notes?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{invoice.notes}</p>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Pembayaran dapat dilakukan ke:</p>
                    {primaryBankAccount ? (
                      <div className="mt-3 space-y-1 text-sm">
                        <p className="font-semibold text-slate-700">{primaryBankAccount.bankName}</p>
                        <p className="font-semibold text-slate-700">{primaryBankAccount.accountNumber}</p>
                        <p className="text-slate-600">a.n {primaryBankAccount.accountHolder}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">Belum ada rekening aktif.</p>
                    )}
                  </>
                )}
                <h3 className="mt-5 text-lg font-semibold text-slate-900">Syarat dan Ketentuan</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{invoice.terms?.trim() || "-"}</p>
              </div>
              <div className="flex flex-col items-center justify-between border-t border-slate-200 pt-2 text-center sm:items-end sm:text-right">
                <p className="text-sm">{formatDate(invoice.createdAt)}</p>
                <div>
                  {invoice.orgSignatureUrl ? (
                    <Image
                      src={invoice.orgSignatureUrl}
                      alt="Tanda tangan"
                      width={220}
                      height={110}
                      unoptimized
                      className="mx-auto h-24 w-auto object-contain sm:ml-auto"
                    />
                  ) : null}
                  <p className="mt-1 text-sm font-semibold text-slate-800">{invoice.orgResponsibleName ?? invoice.orgName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="a4-exclude flex flex-col space-y-3 lg:sticky lg:top-4">
          <div className="order-2 lg:order-1">
            <Card className="public-invoice-section rounded-xl border-border/70 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <h2 className="text-base font-semibold text-foreground">Milestones</h2>
                {invoice.milestones.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Belum ada milestone.</p> : null}
                <div className="mt-2.5 space-y-0">
                  {invoice.milestones.map((milestone, index) => {
                    const isLast = index === invoice.milestones.length - 1;
                    const tone = milestoneTone(milestone.status);
                    return (
                      <article key={milestone.id} className="relative pl-6 pb-3.5 last:pb-0">
                        {!isLast ? <span className={`absolute left-[10px] top-4 h-[calc(100%-6px)] w-px ${tone.lineClassName}`} /> : null}
                        <span className={`absolute left-0 top-1 h-[20px] w-[20px] rounded-full border ${tone.nodeClassName}`} />
                        <div className="rounded-lg border border-border/70 bg-background/70 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{milestone.type}</p>
                            <MilestoneStatusIcon status={milestone.status} />
                          </div>
                          <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">{formatMoney(milestone.amountCents, invoice.currency)}</p>
                          <p className="text-[11px] text-muted-foreground">Due: {formatDate(milestone.dueDate)}</p>
                          <p className={`text-[11px] font-medium ${tone.statusClassName}`}>Status: {milestone.status}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="order-3 lg:order-2">
            <Card className="public-invoice-section rounded-xl border-border/70 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="space-y-3 p-4">
                <h2 className="text-base font-semibold text-foreground">Payment Proofs</h2>
                <PublicInvoiceProofUploader
                  token={params.token}
                  milestones={invoice.milestones.map((milestone) => ({
                    id: milestone.id,
                    type: milestone.type
                  }))}
                />
                {invoice.proofs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada bukti pembayaran.</p>
                ) : (
                  <div className="space-y-2.5">
                    {invoice.proofs.map((proof) => {
                      const isImage = proof.mimeType?.startsWith("image/") ?? false;
                      return (
                        <article key={proof.id} className="rounded-lg border border-border/70 bg-background/70 p-2.5">
                          <p className="text-[11px] text-muted-foreground">
                            {proof.milestoneType ?? "-"} • {formatDate(proof.createdAt)}
                          </p>
                          {isImage ? (
                            <Image
                              src={proof.mediaUrl}
                              alt="Payment proof"
                              width={960}
                              height={540}
                              unoptimized
                              className="mt-1.5 h-auto w-full rounded-md border border-border/70 object-cover"
                            />
                          ) : (
                            <Button type="button" variant="secondary" size="sm" className="mt-1.5 h-7 text-xs" asChild>
                              <a href={proof.mediaUrl} target="_blank" rel="noreferrer">
                                Lihat file bukti
                              </a>
                            </Button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="order-1 lg:order-3">
            <PublicInvoicePaymentInstructions
              accounts={invoice.bankAccounts}
              formattedTotal={formatMoney(invoice.totalCents, invoice.currency)}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
