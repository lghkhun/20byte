"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DashboardDateRangePickerProps = {
  from: string;
  to: string;
};

function parseDateInput(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function differenceInDaysInclusive(from: Date, to: Date): number {
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

const PRESETS = [
  { label: "7H", days: 7 },
  { label: "30H", days: 30 },
  { label: "90H", days: 90 }
];

export function DashboardDateRangePicker({ from, to }: DashboardDateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: parseDateInput(from),
    to: parseDateInput(to)
  });

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  React.useEffect(() => {
    setRange({
      from: parseDateInput(from),
      to: parseDateInput(to)
    });
  }, [from, to]);

  const selectedDayCount = React.useMemo(() => {
    if (!range?.from || !range?.to) return 0;
    return differenceInDaysInclusive(range.from, range.to);
  }, [range]);

  const activePreset = PRESETS.find((p) => p.days === selectedDayCount)?.days ?? null;

  function applyRange(nextRange: DateRange | undefined) {
    setRange(nextRange);
    if (!nextRange?.from || !nextRange?.to) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", toDateParam(nextRange.from));
    params.set("to", toDateParam(nextRange.to));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  function applyPreset(days: number) {
    const today = new Date();
    const start = addDays(today, -(days - 1));
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", toDateParam(start));
    params.set("to", toDateParam(today));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  const dateLabel = range?.from
    ? range.to
      ? `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`
      : format(range.from, "dd MMM yyyy")
    : "Pilih tanggal";

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-9 w-full items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 text-left text-sm transition hover:bg-muted/50 md:w-auto"
    >
      <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="flex-1 truncate text-[12px] font-medium text-foreground/80">{dateLabel}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );

  const calendarContent = (
    <Calendar
      mode="range"
      numberOfMonths={isMobile ? 1 : 2}
      selected={range}
      defaultMonth={range?.from}
      onSelect={applyRange}
      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
    />
  );

  return (
    <div className="flex items-center gap-1.5">
      {/* Preset pills — hidden on mobile */}
      <div className="hidden items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 md:flex">
        {PRESETS.map(({ label, days }) => (
          <button
            key={days}
            type="button"
            onClick={() => applyPreset(days)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all",
              activePreset === days
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date range trigger */}
      {isMobile ? (
        <>
          {trigger}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex w-auto max-w-[min(400px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[10px] p-0">
              <DialogHeader className="border-b border-border/60 px-5 py-3.5">
                <DialogTitle className="text-base">Pilih Rentang Tanggal</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center p-3">{calendarContent}</div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-auto rounded-2xl border-border/70 p-3">
            {calendarContent}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
