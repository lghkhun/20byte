"use client";

import { useState } from "react";

type BankAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

type PublicInvoicePaymentInstructionsProps = {
  accounts: BankAccount[];
  formattedTotal: string;
};

export function PublicInvoicePaymentInstructions({
  accounts,
  formattedTotal
}: PublicInvoicePaymentInstructionsProps) {
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedMessage(successMessage);
      setTimeout(() => setCopiedMessage(null), 1500);
    } catch {
      setCopiedMessage("Copy failed.");
      setTimeout(() => setCopiedMessage(null), 1500);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface/80 p-5">
      <h2 className="text-sm font-semibold text-foreground">Payment Instructions</h2>

      {accounts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No bank account configured yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {accounts.map((account, index) => (
            <article key={`${account.accountNumber}-${index}`} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-foreground">{account.bankName}</p>
                  <p className="text-xs text-muted-foreground">Account No: {account.accountNumber}</p>
                  <p className="text-xs text-muted-foreground">Account Holder: {account.accountHolder}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void copyText(account.accountNumber, "Account number copied.");
                  }}
                  className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
                >
                  Copy account
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Transfer exact amount: {formattedTotal}</p>
        <button
          type="button"
          onClick={() => {
            void copyText(formattedTotal, "Transfer amount copied.");
          }}
          className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
        >
          Copy amount
        </button>
      </div>

      {copiedMessage ? <p className="mt-2 text-xs text-emerald-300">{copiedMessage}</p> : null}
    </section>
  );
}
