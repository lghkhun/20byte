import type { ConversationItem } from "@/components/inbox/types";

type ConversationHeaderProps = {
  conversation: ConversationItem | null;
  isLoading: boolean;
};

function formatDateTime(value: string | null): string {
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

export function ConversationHeader({ conversation, isLoading }: ConversationHeaderProps) {
  if (isLoading) {
    return (
      <header className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading conversation...</p>
      </header>
    );
  }

  if (!conversation) {
    return (
      <header className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Conversation Header</h2>
        <p className="mt-2 text-sm text-muted-foreground">Select a conversation to view customer details.</p>
      </header>
    );
  }

  return (
    <header className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {conversation.customerDisplayName ?? "Unknown Customer"}
          </h2>
          <p className="text-sm text-muted-foreground">{conversation.customerPhoneE164}</p>
        </div>
        <span
          className={
            conversation.status === "OPEN"
              ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500"
              : "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-500"
          }
        >
          {conversation.status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <p>Assigned Member: {conversation.assignedToMemberId ?? "Unassigned"}</p>
        <p>Unread: {conversation.unreadCount}</p>
        <p>Last Activity: {formatDateTime(conversation.lastMessageAt)}</p>
      </div>
    </header>
  );
}
