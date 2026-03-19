"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

export function DashboardDateRangePicker({ from, to }: DashboardDateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: parseDateInput(from),
    to: parseDateInput(to)
  });

  React.useEffect(() => {
    setRange({
      from: parseDateInput(from),
      to: parseDateInput(to)
    });
  }, [from, to]);

  const selectedDayCount = React.useMemo(() => {
    if (!range?.from || !range?.to) {
      return 0;
    }

    return differenceInDaysInclusive(range.from, range.to);
  }, [range]);

  function applyRange(nextRange: DateRange | undefined) {
    setRange(nextRange);
    if (!nextRange?.from || !nextRange?.to) {
      return;
    }

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[7, 30, 90].map((days) => (
        <Button
          key={days}
          type="button"
          variant="outline"
          className={cn(
            "h-10 rounded-xl border-border/70 bg-background/70",
            selectedDayCount === days && "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          )}
          onClick={() => applyPreset(days)}
        >
          {days} hari
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full min-w-0 justify-start rounded-xl border-border/70 bg-background/70 text-left font-normal sm:w-auto sm:min-w-[280px]",
              !range?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {range?.from ? (
              range.to ? (
                <>{format(range.from, "dd MMM yyyy")} - {format(range.to, "dd MMM yyyy")}</>
              ) : (
                format(range.from, "dd MMM yyyy")
              )
            ) : (
              <span>Pilih rentang tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto rounded-2xl border-border/70 p-0">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            defaultMonth={range?.from}
            onSelect={applyRange}
            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
