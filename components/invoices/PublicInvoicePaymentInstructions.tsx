"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="public-invoice-section public-invoice-payment rounded-2xl border-border/70 shadow-sm">
      <CardContent className="p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Payment Instructions</h2>

        {accounts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No bank account configured yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {accounts.map((account, index) => (
              <article key={`${account.accountNumber}-${index}`} className="rounded-xl border border-border/70 bg-background/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                    <p className="text-xs text-muted-foreground">Account No: {account.accountNumber}</p>
                    <p className="text-xs text-muted-foreground">Account Holder: {account.accountHolder}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="print-hidden"
                    onClick={() => {
                      void copyText(account.accountNumber, "Account number copied.");
                    }}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy account
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="text-sm text-muted-foreground">Transfer exact amount: {formattedTotal}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="print-hidden"
            onClick={() => {
              void copyText(formattedTotal, "Transfer amount copied.");
            }}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy amount
          </Button>
        </div>

        {copiedMessage ? <p className="print-hidden mt-2 text-xs text-emerald-600">{copiedMessage}</p> : null}
      </CardContent>
    </Card>
  );
}
