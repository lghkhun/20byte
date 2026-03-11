import { useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";

import { ConversationListFilters } from "@/components/inbox/conversation-list/ConversationListFilters";
import { ConversationRow } from "@/components/inbox/conversation-list/ConversationRow";
import { ConversationListSkeleton } from "@/components/inbox/conversation-list/ConversationListSkeleton";
import type { ConversationListFilter, ConversationItem, ConversationStatusFilter } from "@/components/inbox/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStatePanel, ErrorStatePanel } from "@/components/ui/state-panels";

type ConversationListPanelProps = {
  density: "compact" | "comfy";
  conversations: ConversationItem[];
  selectedConversationId: string | null;
  filter: ConversationListFilter;
  status: ConversationStatusFilter;
  isLoading: boolean;
  error: string | null;
  onFilterChange: (nextFilter: ConversationListFilter) => void;
  onStatusChange: (nextStatus: ConversationStatusFilter) => void;
  onSelectConversation: (conversationId: string) => void;
  onRefresh: () => void;
};

export function ConversationListPanel({
  density,
  conversations,
  selectedConversationId,
  filter,
  status,
  isLoading,
  error,
  onFilterChange,
  onStatusChange,
  onSelectConversation,
  onRefresh
}: ConversationListPanelProps) {
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const haystacks = [conversation.customerDisplayName ?? "", conversation.customerPhoneE164, conversation.lastMessagePreview ?? ""];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [conversations, searchText]);

  return (
    <section className="flex h-full flex-col bg-card/85 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-card/95 px-4 py-4 sm:px-5 sm:py-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Chats</h2>
          <p className="text-xs text-muted-foreground">{filteredConversations.length} conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-2 border border-border/70 px-2.5 sm:px-3"
            title="Start new chat workflow"
            onClick={() => {
              setSearchText("");
              onStatusChange("OPEN");
              onFilterChange("UNASSIGNED");
              searchInputRef.current?.focus();
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-border/70" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh conversations</span>
          </Button>
        </div>
      </div>

      <div className="border-b border-border/80 bg-card/90 px-4 py-3.5 sm:px-5 sm:py-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search chats..."
            className="h-10 rounded-lg border-border bg-background/85 pl-9"
          />
        </label>
      </div>

      <ConversationListFilters filter={filter} status={status} onFilterChange={onFilterChange} onStatusChange={onStatusChange} />

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto border-t border-border/80">
        {isLoading ? <ConversationListSkeleton /> : null}
        {!isLoading && error ? <ErrorStatePanel title="Failed to Load Conversations" message={error} /> : null}

        {!isLoading && !error && filteredConversations.length === 0 ? (
          <EmptyStatePanel title="No Conversations" message="No conversations found for selected filter." />
        ) : null}

        {!isLoading && !error && filteredConversations.length > 0 ? (
          <div className="divide-y divide-border/80">
            {filteredConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                density={density}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onSelect={onSelectConversation}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
