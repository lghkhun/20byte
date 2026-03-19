"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type {
  ConversationCrmContextResponse,
  ConversationFetchResponse,
  CustomerNotesResponse,
  CustomerTagsResponse,
  ListConversationsResponse,
  ListMessagesResponse
} from "@/components/inbox/workspace/types";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
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
    conversations,
    messages,
    setMetaTotal,
    setConversations
  } = state;

  const hasLoadedConversationListRef = useRef(false);
  const hasLoadedMessagesRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastNotificationAtRef = useRef(0);
  const previousUnreadTotalRef = useRef(0);
  const conversationSnapshotRef = useRef<string>("");
  const messagesSnapshotRef = useRef<string>("");
  const conversationsRef = useRef(conversations);
  const selectedConversationIdRef = useRef(selectedConversationId);
  const messagesLengthRef = useRef(messages.length);
  const isLoadingConversationsRef = useRef(false);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  const playInboundNotification = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (Date.now() - lastNotificationAtRef.current < 1500) {
      return;
    }
    lastNotificationAtRef.current = Date.now();

    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    try {
      const audioContext = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => {
          // ignore autoplay resume failure
        });
      }

      const now = audioContext.currentTime;
      [0, 0.11].forEach((offset) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, now + offset);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.07, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);

        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.15);
      });
    } catch {
      // ignore audio failures
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, options?: { background?: boolean }) => {
      if (!orgId) {
        return;
      }

      if (!options?.background) {
        setIsLoadingMessages(true);
        setMessageError(null);
      }
      try {
        const response = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}&page=1&limit=30`);
        const payload = (await response.json().catch(() => null)) as ListMessagesResponse | null;
        if (!response.ok) {
          if (!options?.background) {
            setMessageError(payload?.error?.message ?? "Failed to load messages.");
          }
          return;
        }

        const nextMessages = payload?.data?.messages ?? [];
        const previousLength = messagesLengthRef.current;
        const latestMessage = nextMessages[nextMessages.length - 1] ?? null;
        const nextSnapshot = JSON.stringify(
          nextMessages.map((message) => ({
            id: message.id,
            sendStatus: message.sendStatus,
            sendError: message.sendError,
            createdAt: message.createdAt
          }))
        );
        const changed = nextSnapshot !== messagesSnapshotRef.current;

        if (!options?.background || changed) {
          setMessages(nextMessages);
          messagesSnapshotRef.current = nextSnapshot;
        }
        if (selectedConversationIdRef.current === conversationId && hasLoadedMessagesRef.current && changed) {
          if (nextMessages.length > previousLength && latestMessage?.direction === "INBOUND") {
            playInboundNotification();
          }
        }
        hasLoadedMessagesRef.current = true;
      } catch {
        if (!options?.background) {
          setMessageError("Network error while loading messages.");
        }
      } finally {
        if (!options?.background) {
          setIsLoadingMessages(false);
        }
      }
    },
    [orgId, playInboundNotification, setIsLoadingMessages, setMessageError, setMessages]
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
          fetch(`/api/customers/${encodeURIComponent(customerId)}/tags`),
          fetch(`/api/customers/${encodeURIComponent(customerId)}/notes?page=1&limit=20`)
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
        const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/crm-context`);
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
    async (conversationId: string, options?: { background?: boolean }) => {
      if (!orgId) {
        return;
      }

      if (!options?.background) {
        setIsLoadingConversation(true);
        setError(null);
      }
      try {
        const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`);
        const payload = (await response.json().catch(() => null)) as ConversationFetchResponse | null;
        if (!response.ok) {
          if (!options?.background) {
            setError(payload?.error?.message ?? "Failed to fetch conversation.");
          }
          return;
        }

        const conversation = payload?.data?.conversation ?? null;
        setSelectedConversation(conversation);
        const shouldHydrateCrmContext = !options?.background;
        const crmHydrationPromise =
          shouldHydrateCrmContext && conversation?.customerId
            ? Promise.all([loadCustomerCrmContext(conversation.customerId), loadConversationCrmContext(conversation.id)])
            : shouldHydrateCrmContext
              ? Promise.resolve().then(() => {
                  setTags([]);
                  setNotes([]);
                  setCrmInvoices([]);
                  setCrmActivity([]);
                })
              : Promise.resolve();

        await loadMessages(conversationId, options);
        void crmHydrationPromise;
      } catch {
        if (!options?.background) {
          setError("Network error while fetching conversation.");
        }
      } finally {
        if (!options?.background) {
          setIsLoadingConversation(false);
        }
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

  const loadConversations = useCallback(async (options?: { background?: boolean }) => {
    if (!orgId) {
      return;
    }
    if (isLoadingConversationsRef.current && options?.background) {
      return;
    }

    isLoadingConversationsRef.current = true;

    if (!options?.background) {
      setIsLoadingList(true);
      setError(null);
    }
    try {
      const response = await fetch(`/api/conversations?filter=${encodeURIComponent(filter)}&status=${encodeURIComponent(statusFilter)}&page=1&limit=20`);
      const payload = (await response.json().catch(() => null)) as ListConversationsResponse | null;
      if (!response.ok) {
        if (!options?.background) {
          setError(payload?.error?.message ?? "Failed to load conversations.");
        }
        return;
      }

      const rows = payload?.data?.conversations ?? [];
      const nextUnreadTotal = rows.reduce((total, row) => total + row.unreadCount, 0);
      const currentSelectedConversationId = selectedConversationIdRef.current;
      const nextConversationId =
        currentSelectedConversationId && rows.some((row) => row.id === currentSelectedConversationId)
          ? currentSelectedConversationId
          : rows[0]?.id ?? null;
      const nextSnapshot = JSON.stringify(
        rows.map((row) => ({
          id: row.id,
          unreadCount: row.unreadCount,
          lastMessageAt: row.lastMessageAt,
          status: row.status,
          assignedToMemberId: row.assignedToMemberId,
          updatedAt: row.updatedAt
        }))
      );
      const snapshotChanged = nextSnapshot !== conversationSnapshotRef.current;
      const selectedConversationChanged =
        Boolean(nextConversationId) &&
        rows.some(
          (row) =>
            row.id === nextConversationId &&
            row.lastMessageAt !== (conversationsRef.current.find((item) => item.id === nextConversationId)?.lastMessageAt ?? null)
        );

      if (!options?.background || snapshotChanged) {
        setConversations(rows);
        setMetaTotal(payload?.meta?.total ?? rows.length);
        conversationSnapshotRef.current = nextSnapshot;
      }

      if (hasLoadedConversationListRef.current && nextUnreadTotal > previousUnreadTotalRef.current) {
        playInboundNotification();
      }
      previousUnreadTotalRef.current = nextUnreadTotal;
      hasLoadedConversationListRef.current = true;

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

      setSelectedConversationId(nextConversationId);
      if (!options?.background || currentSelectedConversationId !== nextConversationId || selectedConversationChanged) {
        void loadConversation(nextConversationId, options);
      }
    } catch {
      if (!options?.background) {
        setError("Network error while loading conversations.");
      }
    } finally {
      isLoadingConversationsRef.current = false;
      if (!options?.background) {
        setIsLoadingList(false);
      }
    }
  }, [
    filter,
    loadConversation,
    orgId,
    playInboundNotification,
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
        const orgs = await fetchOrganizationsCached();
        if (active) {
          setOrganizations(orgs);
          setOrgId(orgs[0]?.id ?? null);
        }
      } catch {
        if (active) {
          setError("Network error while loading business.");
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
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (!active) {
          return;
        }

        void loadConversations({ background: true });
      }, 250);
    };

    const startSubscription = async () => {
      try {
        cleanup = await subscribeToOrgMessageEvents({
          orgId,
          onMessageNew: (payload) => {
            if (payload.direction === "INBOUND") {
              playInboundNotification();
            }
            scheduleRefresh();
          },
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

    fallbackTimer = setInterval(() => {
      if (!active) {
        return;
      }

      void loadConversations({ background: true });
    }, 15000);

    return () => {
      active = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      if (fallbackTimer) {
        clearInterval(fallbackTimer);
      }

      if (cleanup) {
        cleanup();
      }
    };
  }, [loadConversations, orgId, playInboundNotification]);

  const workspaceSubtitle = useMemo(() => {
    if (!orgId) {
      return "No business available.";
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
