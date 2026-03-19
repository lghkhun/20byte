"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

type PublicInvoiceToolbarProps = {
  token: string;
  hasStoredPdf: boolean;
  storedPdfUrl: string | null;
};

export function PublicInvoiceToolbar({ token, hasStoredPdf, storedPdfUrl }: PublicInvoiceToolbarProps) {
  const generatedPdfUrl = `/api/public-invoices/${encodeURIComponent(token)}/pdf`;

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" className="h-9" asChild>
        <a href={hasStoredPdf && storedPdfUrl ? storedPdfUrl : generatedPdfUrl} target="_blank" rel="noreferrer" download>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-9"
        onClick={() => {
          window.print();
        }}
      >
        <Printer className="mr-2 h-4 w-4" />
        Print / Save PDF
      </Button>
    </div>
  );
}
