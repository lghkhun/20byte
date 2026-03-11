"use client";

import { useCallback, useEffect, useMemo } from "react";

import type {
  ConversationCrmContextResponse,
  ConversationFetchResponse,
  CustomerNotesResponse,
  CustomerTagsResponse,
  ListConversationsResponse,
  ListMessagesResponse,
  OrganizationsResponse
} from "@/components/inbox/workspace/types";
import { subscribeToOrgMessageEvents } from "@/lib/ably/client";

import type { InboxWorkspaceState } from "./useInboxWorkspaceState";

export function useInboxWorkspaceLoaders(state: InboxWorkspaceState) {
  const {
    organizations,
    setOrganizations,
    orgId,
    setOrgId,
    filter,
    statusFilter,
    selectedConversationId,
    setSelectedConversationId,
    setSelectedConversation,
    setIsLoadingList,
    setIsLoadingConversation,
    setMessages,
    setIsLoadingMessages,
    setError,
    setMessageError,
    setCrmError,
    setIsLoadingCrm,
    setSelectedProofMessageId,
    setTags,
    setNotes,
    setCrmInvoices,
    setCrmActivity,
    metaTotal,
    setMetaTotal,
    setConversations
  } = state;

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
    [orgId, setIsLoadingMessages, setMessageError, setMessages]
  );

  const loadCustomerCrmContext = useCallback(
    async (customerId: string) => {
      if (!orgId) {
        return;
      }

      setIsLoadingCrm(true);
      setCrmError(null);
      try {
        const [tagsResponse, notesResponse] = await Promise.all([
          fetch(`/api/customers/${encodeURIComponent(customerId)}/tags?orgId=${encodeURIComponent(orgId)}`),
          fetch(`/api/customers/${encodeURIComponent(customerId)}/notes?orgId=${encodeURIComponent(orgId)}&page=1&limit=20`)
        ]);

        const tagsPayload = (await tagsResponse.json().catch(() => null)) as CustomerTagsResponse | null;
        const notesPayload = (await notesResponse.json().catch(() => null)) as CustomerNotesResponse | null;

        if (!tagsResponse.ok) {
          setCrmError(tagsPayload?.error?.message ?? "Failed to load tags.");
          return;
        }

        if (!notesResponse.ok) {
          setCrmError(notesPayload?.error?.message ?? "Failed to load notes.");
          return;
        }

        setTags(tagsPayload?.data?.tags ?? []);
        setNotes(notesPayload?.data?.notes ?? []);
      } catch {
        setCrmError("Network error while loading CRM context.");
      } finally {
        setIsLoadingCrm(false);
      }
    },
    [orgId, setCrmError, setIsLoadingCrm, setNotes, setTags]
  );

  const loadConversationCrmContext = useCallback(
    async (conversationId: string) => {
      if (!orgId) {
        return;
      }

      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/crm-context?orgId=${encodeURIComponent(orgId)}`
        );
        const payload = (await response.json().catch(() => null)) as ConversationCrmContextResponse | null;

        if (!response.ok) {
          setCrmError(payload?.error?.message ?? "Failed to load invoice timeline.");
          setCrmInvoices([]);
          setCrmActivity([]);
          return;
        }

        setCrmInvoices(payload?.data?.invoices ?? []);
        setCrmActivity(payload?.data?.events ?? []);
      } catch {
        setCrmError("Network error while loading invoice timeline.");
        setCrmInvoices([]);
        setCrmActivity([]);
      }
    },
    [orgId, setCrmActivity, setCrmError, setCrmInvoices]
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

        const conversation = payload?.data?.conversation ?? null;
        setSelectedConversation(conversation);
        if (conversation?.customerId) {
          await Promise.all([loadCustomerCrmContext(conversation.customerId), loadConversationCrmContext(conversation.id)]);
        } else {
          setTags([]);
          setNotes([]);
          setCrmInvoices([]);
          setCrmActivity([]);
        }

        await loadMessages(conversationId);
      } catch {
        setError("Network error while fetching conversation.");
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [
      loadConversationCrmContext,
      loadCustomerCrmContext,
      loadMessages,
      orgId,
      setCrmActivity,
      setCrmInvoices,
      setError,
      setIsLoadingConversation,
      setNotes,
      setSelectedConversation,
      setTags
    ]
  );

  const loadConversations = useCallback(async () => {
    if (!orgId) {
      return;
    }

    setIsLoadingList(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/conversations?orgId=${encodeURIComponent(orgId)}&filter=${encodeURIComponent(filter)}&status=${encodeURIComponent(statusFilter)}&page=1&limit=20`
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
        setSelectedProofMessageId(null);
        setTags([]);
        setNotes([]);
        setCrmInvoices([]);
        setCrmActivity([]);
        return;
      }

      const nextConversationId = selectedConversationId && rows.some((row) => row.id === selectedConversationId) ? selectedConversationId : rows[0].id;
      setSelectedConversationId(nextConversationId);
      await loadConversation(nextConversationId);
    } catch {
      setError("Network error while loading conversations.");
    } finally {
      setIsLoadingList(false);
    }
  }, [
    filter,
    loadConversation,
    orgId,
    selectedConversationId,
    setConversations,
    setCrmActivity,
    setCrmInvoices,
    setError,
    setIsLoadingList,
    setMessages,
    setMetaTotal,
    setNotes,
    setSelectedConversation,
    setSelectedConversationId,
    setSelectedProofMessageId,
    setTags,
    statusFilter
  ]);

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
          setOrganizations(orgs);
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
  }, [setError, setOrgId, setOrganizations]);

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
          onMessageNew: scheduleRefresh,
          onConversationUpdated: scheduleRefresh,
          onAssignmentChanged: scheduleRefresh,
          onInvoiceCreated: scheduleRefresh,
          onInvoiceUpdated: scheduleRefresh,
          onInvoicePaid: scheduleRefresh,
          onProofAttached: scheduleRefresh,
          onCustomerUpdated: scheduleRefresh,
          onStorageUpdated: scheduleRefresh
        });
      } catch (subscriptionError) {
        const message = subscriptionError instanceof Error ? subscriptionError.message : "Unknown realtime subscribe error";
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

  const activeOrgRole = useMemo(() => {
    if (!orgId) {
      return null;
    }

    return organizations.find((item) => item.id === orgId)?.role ?? null;
  }, [orgId, organizations]);

  return {
    workspaceSubtitle,
    activeOrgRole,
    loadMessages,
    loadConversation,
    loadConversations,
    loadCustomerCrmContext,
    loadConversationCrmContext
  };
}

export type InboxWorkspaceLoaders = ReturnType<typeof useInboxWorkspaceLoaders>;
