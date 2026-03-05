import { MessageBubble } from "@/components/inbox/MessageBubble";
import { MessageInput } from "@/components/inbox/MessageInput";
import { MessageItem } from "@/components/inbox/types";

type ChatWindowProps = {
  messages: MessageItem[];
  isLoading: boolean;
  isConversationSelected: boolean;
  error: string | null;
  onSendText: (text: string) => Promise<void>;
};

export function ChatWindow({ messages, isLoading, isConversationSelected, error, onSendText }: ChatWindowProps) {
  return (
    <section className="flex min-h-[420px] flex-col gap-3 rounded-xl border border-border bg-surface/70 p-4">
      <h2 className="text-sm font-semibold text-foreground">Chat Window</h2>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/40 p-3">
        {!isConversationSelected ? (
          <p className="text-sm text-muted-foreground">Select a conversation to view messages.</p>
        ) : null}

        {isConversationSelected && isLoading ? <p className="text-sm text-muted-foreground">Loading messages...</p> : null}

        {isConversationSelected && !isLoading && error ? <p className="text-sm text-destructive">{error}</p> : null}

        {isConversationSelected && !isLoading && !error && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : null}

        {isConversationSelected && !isLoading && !error && messages.length > 0
          ? messages.map((message) => <MessageBubble key={message.id} message={message} />)
          : null}
      </div>

      <MessageInput disabled={!isConversationSelected} onSendText={onSendText} />
    </section>
  );
}
