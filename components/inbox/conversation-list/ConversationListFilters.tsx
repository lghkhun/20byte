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
    <div className="space-y-3 border-t border-border/70 bg-card/30 px-5 py-3">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
        <div className="flex gap-2">
          {(["OPEN", "CLOSED"] as ConversationStatusFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === status}
              onClick={() => onStatusChange(item)}
              className={
                item === status
                  ? "rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium text-primary shadow-sm transition"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-accent/70 hover:text-foreground"
              }
            >
              {STATUS_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Visibility</p>
        <div className="flex gap-2">
          {(["UNASSIGNED", "MY", "ALL"] as ConversationListFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === filter}
              onClick={() => onFilterChange(item)}
              className={
                item === filter
                  ? "rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium text-primary shadow-sm transition"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-accent/70 hover:text-foreground"
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
