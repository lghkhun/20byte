"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PublicInvoiceToolbar() {
  return (
    <div className="print-hidden flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-1 py-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-md"
        title="Download A4 PDF"
        aria-label="Download A4 PDF"
        onClick={() => {
          window.print();
        }}
      >
        <Download className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-md"
        title="Print / Save PDF"
        aria-label="Print / Save PDF"
        onClick={() => {
          window.print();
        }}
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}
