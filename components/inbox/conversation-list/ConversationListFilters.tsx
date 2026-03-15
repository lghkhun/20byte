import type { ConversationListFilter, ConversationStatusFilter } from "@/components/inbox/types";
import { FILTER_LABELS, STATUS_LABELS } from "@/components/inbox/conversation-list/constants";

type ConversationListFiltersProps = {
  filter: ConversationListFilter;
  status: ConversationStatusFilter;
  onFilterChange: (nextFilter: ConversationListFilter) => void;
  onStatusChange: (nextStatus: ConversationStatusFilter) => void;
};

export function ConversationListFilters({
  filter,
  status,
  onFilterChange,
  onStatusChange
}: ConversationListFiltersProps) {
  return (
    <div className="space-y-3 border-t border-border/70 bg-card/60 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Status</span>
        <div className="flex flex-wrap gap-2">
          {(["OPEN", "CLOSED"] as ConversationStatusFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === status}
              onClick={() => onStatusChange(item)}
              className={
                item === status
                  ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition"
                  : "rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent/70 hover:text-foreground"
              }
            >
              {STATUS_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">View</span>
        <div className="flex flex-wrap gap-2">
          {(["UNASSIGNED", "MY", "ALL"] as ConversationListFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === filter}
              onClick={() => onFilterChange(item)}
              className={
                item === filter
                  ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition"
                  : "rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent/70 hover:text-foreground"
              }
            >
              {FILTER_LABELS[item]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
