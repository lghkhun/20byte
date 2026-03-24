import { useEffect } from "react";

const INBOX_SELECTED_CONVERSATION_PREFIX = "inbox-selected-conversation";

type ConversationLike = {
  id: string;
};

type UseInboxSelectedConversationPersistenceInput = {
  orgId: string | null;
  selectedConversationId: string | null;
  conversations: ConversationLike[];
  setSelectedConversationId: (conversationId: string | null) => void;
  loadConversation: (conversationId: string) => Promise<void>;
};

export function useInboxSelectedConversationPersistence({
  orgId,
  selectedConversationId,
  conversations,
  setSelectedConversationId,
  loadConversation
}: UseInboxSelectedConversationPersistenceInput) {
  useEffect(() => {
    if (!orgId) {
      return;
    }

    if (selectedConversationId) {
      window.localStorage.setItem(`${INBOX_SELECTED_CONVERSATION_PREFIX}:${orgId}`, selectedConversationId);
      return;
    }

    window.localStorage.removeItem(`${INBOX_SELECTED_CONVERSATION_PREFIX}:${orgId}`);
  }, [orgId, selectedConversationId]);

  useEffect(() => {
    if (!orgId || conversations.length === 0) {
      return;
    }

    const storedConversationId = window.localStorage.getItem(`${INBOX_SELECTED_CONVERSATION_PREFIX}:${orgId}`);
    if (!storedConversationId) {
      return;
    }

    const exists = conversations.some((conversation) => conversation.id === storedConversationId);
    if (!exists || storedConversationId === selectedConversationId) {
      return;
    }

    setSelectedConversationId(storedConversationId);
    void loadConversation(storedConversationId);
  }, [conversations, loadConversation, orgId, selectedConversationId, setSelectedConversationId]);
}
