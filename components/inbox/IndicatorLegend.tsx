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
      <PopoverContent align="end" className="w-[300px] rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-[15px] font-bold text-foreground">Panduan Indikator</h4>
            <p className="text-[12px] text-muted-foreground">Arti dari simbol dan status di Inbox.</p>
          </div>
          
          <div className="space-y-2.5 text-[12px] leading-relaxed text-muted-foreground/90">
            <div className="flex gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <p><span className="font-bold text-foreground">Online:</span> Customer atau chat sedang aktif.</p>
            </div>
            <div className="flex gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <p><span className="font-bold text-foreground">Offline:</span> Chat ditutup atau tidak ada aktivitas baru.</p>
            </div>
            <div className="flex gap-3">
              <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17L4 12"/></svg>
              <p><span className="font-bold text-foreground">Satu Centang:</span> Terkirim ke server WhatsApp.</p>
            </div>
            <div className="flex gap-3">
              <div className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13L9 20L22 7"/><path d="M16 7L9 14L2 7"/></svg>
              </div>
              <p><span className="font-bold text-foreground">Dua Centang:</span> Pesan sampai di HP customer.</p>
            </div>
            <div className="flex gap-3">
              <div className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center text-sky-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13L9 20L22 7"/><path d="M16 7L9 14L2 7"/></svg>
              </div>
              <p><span className="font-bold text-foreground text-sky-600">Dua Centang Biru:</span> Pesan sudah dibaca.</p>
            </div>
            <div className="flex gap-3">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
              <p><span className="font-bold text-foreground">Proof Ready:</span> Lampiran siap dijadikan bukti bayar.</p>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
