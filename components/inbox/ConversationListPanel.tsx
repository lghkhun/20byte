import { ConversationListFilter, ConversationItem } from "@/components/inbox/types";

type ConversationListPanelProps = {
  conversations: ConversationItem[];
  selectedConversationId: string | null;
  filter: ConversationListFilter;
  isLoading: boolean;
  error: string | null;
  onFilterChange: (nextFilter: ConversationListFilter) => void;
  onSelectConversation: (conversationId: string) => void;
  onRefresh: () => void;
};

const FILTER_LABELS: Record<ConversationListFilter, string> = {
  UNASSIGNED: "Unassigned",
  MY: "My Chats",
  ALL: "All Chats"
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function ConversationListPanel({
  conversations,
  selectedConversationId,
  filter,
  isLoading,
  error,
  onFilterChange,
  onSelectConversation,
  onRefresh
}: ConversationListPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Conversation List</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        {(["UNASSIGNED", "MY", "ALL"] as ConversationListFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onFilterChange(item)}
            className={
              item === filter
                ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                : "rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            {FILTER_LABELS[item]}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading conversations...</p> : null}
      {!isLoading && error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!isLoading && !error && conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No conversations for this filter.</p>
      ) : null}

      {!isLoading && !error && conversations.length > 0 ? (
        <div className="space-y-2">
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
                className={
                  isSelected
                    ? "flex w-full flex-col rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left"
                    : "flex w-full flex-col rounded-lg border border-border px-3 py-2 text-left hover:bg-accent"
                }
              >
                <span className="text-sm font-medium text-foreground">
                  {conversation.customerDisplayName ?? conversation.customerPhoneE164}
                </span>
                <span className="text-xs text-muted-foreground">{conversation.customerPhoneE164}</span>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{conversation.assignedToMemberId ? "Assigned" : "Unassigned"}</span>
                  <span>{formatTimestamp(conversation.lastMessageAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
