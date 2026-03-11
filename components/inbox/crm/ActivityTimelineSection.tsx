"use client";

import type { CrmTimelineItem } from "@/components/inbox/crm/types";

type ActivityTimelineSectionProps = {
  timelineItems: CrmTimelineItem[];
  formatDateTime: (value: string | null) => string;
};

export function ActivityTimelineSection({ timelineItems, formatDateTime }: ActivityTimelineSectionProps) {
  return (
    <section className="rounded-xl border border-border/80 bg-background/50 p-3.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity Timeline</p>
      {timelineItems.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No activity yet.</p> : null}
      {timelineItems.length > 0 ? (
        <div className="mt-2 space-y-2">
          {timelineItems.slice(0, 10).map((item) => (
            <article key={item.id} className="rounded-lg border border-border/80 bg-background/70 p-2.5">
              <p className="text-xs text-foreground">{item.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.time)}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
