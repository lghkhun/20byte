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
        <div className="mt-4 space-y-0">
          {timelineItems.slice(0, 10).map((item) => (
            <article key={item.id} className="relative pl-8">
              <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="absolute left-[0.9rem] top-4 bottom-0 w-px bg-border last:hidden" />
              <div className="rounded-xl border border-border/80 bg-background/70 px-3 py-3">
                <p className="text-sm text-foreground">{item.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.time)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
