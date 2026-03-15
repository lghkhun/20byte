"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", defaultClassNames.root, className)}
      classNames={{
        months: cn("relative", defaultClassNames.months),
        month: cn("space-y-4", defaultClassNames.month),
        month_caption: cn("relative flex items-center justify-center pt-1", defaultClassNames.month_caption),
        caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),
        nav: cn("flex items-center gap-1", defaultClassNames.nav),
        button_previous:
          "absolute left-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
        button_next:
          "absolute right-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("mb-1 grid grid-cols-7", defaultClassNames.weekdays),
        weekday: cn("flex h-9 items-center justify-center text-xs font-medium text-muted-foreground", defaultClassNames.weekday),
        weeks: cn("space-y-1", defaultClassNames.weeks),
        week: cn("grid grid-cols-7", defaultClassNames.week),
        day: cn("flex items-center justify-center", defaultClassNames.day),
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal text-foreground transition hover:bg-accent hover:text-accent-foreground",
        selected:
          "rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "rounded-md bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-45",
        disabled: "text-muted-foreground opacity-35",
        hidden: "invisible",
        chevron: "h-4 w-4",
        ...classNames
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          )
      }}
      {...props}
    />
  );
}
