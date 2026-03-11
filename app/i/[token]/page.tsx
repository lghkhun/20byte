import { notFound } from "next/navigation";
import Image from "next/image";

import { PublicInvoicePaymentInstructions } from "@/components/invoices/PublicInvoicePaymentInstructions";
import { getPublicInvoiceByToken } from "@/server/services/publicInvoiceService";

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-4 px-4 py-8">
      <header className="rounded-xl border border-border bg-surface/80 p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Public Invoice</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{invoice.orgName}</h1>
          {invoice.pdfUrl ? (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Download PDF
            </a>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Invoice No: {invoice.invoiceNo}</p>
          <p>Status: {invoice.status}</p>
          <p>Customer: {invoice.customerName ?? invoice.customerPhoneE164}</p>
          <p>Phone: {invoice.customerPhoneE164}</p>
          <p>Created: {formatDate(invoice.createdAt)}</p>
          <p>Due Date: {formatDate(invoice.dueDate)}</p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-surface/80 p-5">
        <h2 className="text-sm font-semibold text-foreground">Invoice Items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Qty</th>
                <th className="py-2 pr-2">Price</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-3 pr-2">
                    <p className="text-foreground">{item.name}</p>
                    {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                  </td>
                  <td className="py-3 pr-2 text-muted-foreground">
                    {item.qty}
                    {item.unit ? ` ${item.unit}` : ""}
                  </td>
                  <td className="py-3 pr-2 text-muted-foreground">{formatRupiah(item.priceCents)}</td>
                  <td className="py-3 text-right text-foreground">{formatRupiah(item.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(invoice.subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatRupiah(invoice.totalCents)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/80 p-5">
        <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {invoice.milestones.map((milestone) => (
            <article key={milestone.id} className="rounded-lg border border-border bg-background/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{milestone.type}</p>
              <p className="mt-1 text-sm text-foreground">{formatRupiah(milestone.amountCents)}</p>
              <p className="text-xs text-muted-foreground">Due: {formatDate(milestone.dueDate)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status: {milestone.status}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/80 p-5">
        <h2 className="text-sm font-semibold text-foreground">Payment Proofs</h2>
        {invoice.proofs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No proof attached yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {invoice.proofs.map((proof) => {
              const isImage = proof.mimeType?.startsWith("image/") ?? false;
              return (
                <article key={proof.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Milestone: {proof.milestoneType ?? "-"} | {formatDate(proof.createdAt)}
                  </p>
                  {isImage ? (
                    <Image
                      src={proof.mediaUrl}
                      alt="Payment proof"
                      width={640}
                      height={360}
                      unoptimized
                      className="mt-2 h-auto w-full rounded-md border border-border object-cover"
                    />
                  ) : (
                    <a
                      href={proof.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
                    >
                      Open proof document
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <PublicInvoicePaymentInstructions
        accounts={invoice.bankAccounts}
        formattedTotal={formatRupiah(invoice.totalCents)}
      />
    </main>
  );
}
