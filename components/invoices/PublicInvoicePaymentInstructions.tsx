"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
    <Card className="public-invoice-section public-invoice-payment rounded-xl border-border/70 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4 md:p-5">
        <h2 className="text-base font-semibold text-foreground">Payment Instructions</h2>

        {accounts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No bank account configured yet.</p>
        ) : (
          <Accordion type="single" collapsible className="mt-2 rounded-xl border border-border/70 bg-background/70 px-2.5">
            {accounts.map((account, index) => (
              <AccordionItem key={`${account.accountNumber}-${index}`} value={`${account.accountNumber}-${index}`} className="border-border/50">
                <AccordionTrigger className="py-2.5 text-xs">
                  <span className="font-medium text-foreground">{account.bankName}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Account No: {account.accountNumber}</p>
                      <p className="text-[11px] text-muted-foreground">Account Holder: {account.accountHolder}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="print-hidden h-7 text-xs"
                      onClick={() => {
                        void copyText(account.accountNumber, "Account number copied.");
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copy account
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-background/70 p-2.5">
          <p className="text-xs text-muted-foreground">Transfer exact amount: {formattedTotal}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="print-hidden h-7 text-xs"
            onClick={() => {
              void copyText(formattedTotal, "Transfer amount copied.");
            }}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy amount
          </Button>
        </div>

        {copiedMessage ? <p className="print-hidden mt-1.5 text-[11px] text-emerald-600">{copiedMessage}</p> : null}
      </CardContent>
    </Card>
  );
}
