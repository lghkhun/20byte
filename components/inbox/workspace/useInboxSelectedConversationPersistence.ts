import { useEffect } from "react";

const INBOX_SELECTED_CONVERSATION_PREFIX = "inbox-selected-conversation";

type ConversationLike = {
  id: string;
};

type UseInboxSelectedConversationPersistenceInput = {
  orgId: string | null;
  selectedConversationId: string | null;
  conversations: ConversationLike[];
};

export function useInboxSelectedConversationPersistence({
  orgId,
  selectedConversationId,
  conversations
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

    const storageKey = `${INBOX_SELECTED_CONVERSATION_PREFIX}:${orgId}`;
    const storedConversationId = window.localStorage.getItem(storageKey);
    if (!storedConversationId) {
      return;
    }

    const exists = conversations.some((conversation) => conversation.id === storedConversationId);
    if (!exists) {
      window.localStorage.removeItem(storageKey);
    }
  }, [conversations, orgId]);
}
