"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ChatWindow } from "@/components/inbox/ChatWindow";
import { ConversationHeader } from "@/components/inbox/ConversationHeader";
import { ConversationListPanel } from "@/components/inbox/ConversationListPanel";
import { ConversationItem, ConversationListFilter, MessageItem } from "@/components/inbox/types";
import { subscribeToOrgMessageEvents } from "@/lib/realtime/ablyClient";

type OrgSummary = {
  id: string;
  name: string;
  role: string;
};

type ListConversationsResponse = {
  data?: {
    conversations?: ConversationItem[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    message?: string;
  };
};

type ConversationFetchResponse = {
  data?: {
    conversation?: ConversationItem;
  };
  error?: {
    message?: string;
  };
};

type OrganizationsResponse = {
  data?: {
    organizations?: OrgSummary[];
  };
  error?: {
    message?: string;
  };
};

type ListMessagesResponse = {
  data?: {
    messages?: MessageItem[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    message?: string;
  };
};

type SendMessageResponse = {
  data?: {
    message?: {
      messageId: string;
    };
  };
  error?: {
    message?: string;
  };
};

export function InboxWorkspace() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationListFilter>("UNASSIGNED");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [metaTotal, setMetaTotal] = useState<number>(0);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!orgId) {
        return;
      }

      setIsLoadingMessages(true);
      setMessageError(null);
      try {
        const response = await fetch(
          `/api/messages?orgId=${encodeURIComponent(orgId)}&conversationId=${encodeURIComponent(conversationId)}&page=1&limit=30`
        );
        const payload = (await response.json().catch(() => null)) as ListMessagesResponse | null;
        if (!response.ok) {
          setMessageError(payload?.error?.message ?? "Failed to load messages.");
          return;
        }

        setMessages(payload?.data?.messages ?? []);
      } catch {
        setMessageError("Network error while loading messages.");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [orgId]
  );

  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (!orgId) {
        return;
      }

      setIsLoadingConversation(true);
      setError(null);
      try {
        const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}?orgId=${encodeURIComponent(orgId)}`);
        const payload = (await response.json().catch(() => null)) as ConversationFetchResponse | null;
        if (!response.ok) {
          setError(payload?.error?.message ?? "Failed to fetch conversation.");
          return;
        }

        setSelectedConversation(payload?.data?.conversation ?? null);
        await loadMessages(conversationId);
      } catch {
        setError("Network error while fetching conversation.");
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [loadMessages, orgId]
  );

  const loadConversations = useCallback(async () => {
    if (!orgId) {
      return;
    }

    setIsLoadingList(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/conversations?orgId=${encodeURIComponent(orgId)}&filter=${encodeURIComponent(filter)}&status=OPEN&page=1&limit=20`
      );
      const payload = (await response.json().catch(() => null)) as ListConversationsResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to load conversations.");
        return;
      }

      const rows = payload?.data?.conversations ?? [];
      setConversations(rows);
      setMetaTotal(payload?.meta?.total ?? rows.length);

      if (rows.length === 0) {
        setSelectedConversationId(null);
        setSelectedConversation(null);
        setMessages([]);
        return;
      }

      const nextConversationId = selectedConversationId && rows.some((row) => row.id === selectedConversationId)
        ? selectedConversationId
        : rows[0].id;
      setSelectedConversationId(nextConversationId);
      await loadConversation(nextConversationId);
    } catch {
      setError("Network error while loading conversations.");
    } finally {
      setIsLoadingList(false);
    }
  }, [filter, loadConversation, orgId, selectedConversationId]);

  useEffect(() => {
    let active = true;

    const loadOrganizations = async () => {
      try {
        const response = await fetch("/api/orgs");
        const payload = (await response.json().catch(() => null)) as OrganizationsResponse | null;
        if (!response.ok) {
          if (active) {
            setError(payload?.error?.message ?? "Failed to load organizations.");
          }
          return;
        }

        const orgs = payload?.data?.organizations ?? [];
        if (active) {
          setOrgId(orgs[0]?.id ?? null);
        }
      } catch {
        if (active) {
          setError("Network error while loading organizations.");
        }
      }
    };

    void loadOrganizations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (!active) {
          return;
        }

        void loadConversations();
      }, 250);
    };

    const startSubscription = async () => {
      try {
        cleanup = await subscribeToOrgMessageEvents({
          orgId,
          onMessageNew: () => {
            scheduleRefresh();
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown realtime subscribe error";
        console.error(`[realtime] inbox subscription failed: ${message}`);
      }
    };

    void startSubscription();

    return () => {
      active = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      if (cleanup) {
        cleanup();
      }
    };
  }, [loadConversations, orgId]);

  const workspaceSubtitle = useMemo(() => {
    if (!orgId) {
      return "No organization available.";
    }

    return `${metaTotal} conversations`;
  }, [metaTotal, orgId]);

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!orgId || !selectedConversationId) {
        return;
      }

      setMessageError(null);
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId,
          conversationId: selectedConversationId,
          type: "TEXT",
          text
        })
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;
      if (!response.ok) {
        setMessageError(payload?.error?.message ?? "Failed to send message.");
        return;
      }

      await loadMessages(selectedConversationId);
      await loadConversations();
    },
    [loadConversations, loadMessages, orgId, selectedConversationId]
  );

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox Workspace</h1>
        <p className="text-sm text-muted-foreground">{workspaceSubtitle}</p>
      </header>

      {!orgId ? (
        <div className="rounded-xl border border-border bg-surface/70 p-4">
          <p className="text-sm text-muted-foreground">Create an organization first to use inbox modules.</p>
        </div>
      ) : null}

      {orgId ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,380px)_minmax(0,1.2fr)_minmax(320px,1fr)]">
          <ConversationListPanel
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            filter={filter}
            isLoading={isLoadingList}
            error={error}
            onFilterChange={(nextFilter) => setFilter(nextFilter)}
            onSelectConversation={(conversationId) => {
              setSelectedConversationId(conversationId);
              void loadConversation(conversationId);
            }}
            onRefresh={() => {
              void loadConversations();
            }}
          />

          <ChatWindow
            messages={messages}
            isLoading={isLoadingMessages}
            isConversationSelected={Boolean(selectedConversationId)}
            error={messageError}
            onSendText={sendTextMessage}
          />

          <ConversationHeader conversation={selectedConversation} isLoading={isLoadingConversation} />
        </div>
      ) : null}
    </section>
  );
}
