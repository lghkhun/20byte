"use client";

import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type IndicatorLegendProps = {
  compact?: boolean;
};

export function IndicatorLegend({ compact = false }: IndicatorLegendProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? "h-7 w-7 rounded-lg border border-border/70" : "h-8 w-8 rounded-lg border border-border/70"}
          title="Indicator guide"
          aria-label="Indicator guide"
        >
          <CircleHelp className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] rounded-xl border border-border/80 p-3">
        <p className="text-sm font-semibold text-foreground">Indicator Guide</p>
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Avatar dot hijau:</span> customer aktif dalam 5 menit terakhir.
          </p>
          <p>
            <span className="font-medium text-foreground">Avatar dot abu:</span> belum ada aktivitas terbaru.
          </p>
          <p>
            <span className="font-medium text-foreground">Dot status hijau:</span> chat masih open.
          </p>
          <p>
            <span className="font-medium text-foreground">Dot status abu:</span> chat sudah closed.
          </p>
          <p>
            <span className="font-medium text-foreground">Badge Proof ready:</span> pesan terakhir inbound gambar/dokumen, siap dijadikan payment proof.
          </p>
          <p>
            <span className="font-medium text-foreground">Badge angka:</span> jumlah chat masuk (unread) per customer.
          </p>
          <p>
            <span className="font-medium text-foreground">✓:</span> pesan sudah diterima server WhatsApp (customer bisa jadi offline).
          </p>
          <p>
            <span className="font-medium text-foreground">✓✓ abu:</span> pesan sudah delivered ke perangkat customer tapi belum dibaca.
          </p>
          <p>
            <span className="font-medium text-foreground">✓✓ biru:</span> pesan sudah dibaca customer.
          </p>
          <p>
            <span className="font-medium text-foreground">Sedang mengetik...</span> muncul realtime saat customer typing.
          </p>
          <p>
            <span className="font-medium text-foreground">Timestamp:</span> waktu aktivitas terakhir customer.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
