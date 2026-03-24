"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type {
  ConversationCrmContextResponse,
  ConversationFetchResponse,
  CustomerTagsResponse,
  ListConversationsResponse,
  ListMessagesResponse
} from "@/components/inbox/workspace/types";
import type { ConversationItem } from "@/components/inbox/types";
import { fetchJsonCached } from "@/lib/client/fetchCache";
import { fetchOrganizationsCached } from "@/lib/client/orgsCache";
import { subscribeToOrgMessageEvents } from "@/lib/ably/client";

import type { InboxWorkspaceState } from "./useInboxWorkspaceState";

export function useInboxWorkspaceLoaders(state: InboxWorkspaceState) {
  const {
    organizations,
    setOrganizations,
    hasLoadedOrganizations,
    setHasLoadedOrganizations,
    orgId,
    setOrgId,
    filter,
    statusFilter,
    selectedConversationId,
    isConversationManuallyCleared,
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
    setCrmInvoices,
    setCrmActivity,
    metaTotal,
    conversations,
    messages,
    setMetaTotal,
    setConversations,
    setTypingConversationId
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
  const conversationsInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const lastBackgroundConversationsLoadAtRef = useRef(0);
  const markReadInFlightRef = useRef(new Set<string>());
  const typingResetTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const recalculateConversationSnapshot = useCallback((rows: ConversationItem[] | null | undefined) => {
    const safeRows = rows ?? [];
    conversationSnapshotRef.current = JSON.stringify(
      safeRows.map((row) => ({
        id: row.id,
        unreadCount: row.unreadCount,
        lastMessageAt: row.lastMessageAt,
        lastMessageType: row.lastMessageType,
        lastMessageDirection: row.lastMessageDirection,
        status: row.status,
        assignedToMemberId: row.assignedToMemberId,
        updatedAt: row.updatedAt
      }))
    );
    previousUnreadTotalRef.current = safeRows.reduce((total, row) => total + row.unreadCount, 0);
  }, []);

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
        const response = await fetch(
          `/api/messages?conversationId=${encodeURIComponent(conversationId)}&page=1&limit=30&orgId=${encodeURIComponent(orgId)}`
        );
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
            deliveryStatus: message.deliveryStatus,
            sendError: message.sendError,
            deliveredAt: message.deliveredAt,
            readAt: message.readAt,
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
        const tagsPayload = await fetchJsonCached<CustomerTagsResponse>(
          `/api/customers/${encodeURIComponent(customerId)}/tags?orgId=${encodeURIComponent(orgId)}`,
          {
            ttlMs: 12_000,
            init: { cache: "no-store" }
          }
        );
        setTags(tagsPayload?.data?.tags ?? []);
      } catch {
        setCrmError("Network error while loading CRM context.");
      } finally {
        setIsLoadingCrm(false);
      }
    },
    [orgId, setCrmError, setIsLoadingCrm, setTags]
  );

  const loadConversationCrmContext = useCallback(
    async (conversationId: string) => {
      if (!orgId) {
        return;
      }

      try {
        const payload = await fetchJsonCached<ConversationCrmContextResponse>(
          `/api/conversations/${encodeURIComponent(conversationId)}/crm-context?orgId=${encodeURIComponent(orgId)}`,
          {
            ttlMs: 12_000,
            init: { cache: "no-store" }
          }
        );
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

  const clearUnreadLocally = useCallback(
    (conversationId: string) => {
      setConversations((previousRows) => {
        let changed = false;
        const nextRows = previousRows.map((row) => {
          if (row.id !== conversationId || row.unreadCount <= 0) {
            return row;
          }

          changed = true;
          return {
            ...row,
            unreadCount: 0
          };
        });

        if (!changed) {
          return previousRows;
        }

        recalculateConversationSnapshot(nextRows);
        return nextRows;
      });

      setSelectedConversation((current) => {
        if (!current || current.id !== conversationId || current.unreadCount <= 0) {
          return current;
        }

        return {
          ...current,
          unreadCount: 0
        };
      });
    },
    [recalculateConversationSnapshot, setConversations, setSelectedConversation]
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!orgId || markReadInFlightRef.current.has(conversationId)) {
        return;
      }

      clearUnreadLocally(conversationId);
      markReadInFlightRef.current.add(conversationId);
      try {
        await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read?orgId=${encodeURIComponent(orgId)}`, {
          method: "POST"
        });
      } catch {
        // Ignore transient failures; next refresh will reconcile unread count.
      } finally {
        markReadInFlightRef.current.delete(conversationId);
      }
    },
    [clearUnreadLocally, orgId]
  );

  const loadConversation = useCallback(
    async (conversationId: string, options?: { background?: boolean }) => {
      if (!orgId) {
        return;
      }

      if (!options?.background) {
        void markConversationRead(conversationId);
      }

      if (!options?.background) {
        setIsLoadingConversation(true);
        setError(null);
      }
      try {
        const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}?orgId=${encodeURIComponent(orgId)}`);
        const payload = (await response.json().catch(() => null)) as ConversationFetchResponse | null;
        if (!response.ok) {
          if (response.status === 404) {
            setSelectedConversationId(null);
            setSelectedConversation(null);
            setMessages([]);
            setSelectedProofMessageId(null);
            setTags([]);
            setCrmInvoices([]);
            setCrmActivity([]);
            return;
          }
          if (!options?.background) {
            setError(payload?.error?.message ?? "Failed to fetch conversation.");
          }
          return;
        }

        const rawConversation = payload?.data?.conversation ?? null;
        const conversation =
          rawConversation && !options?.background
            ? {
                ...rawConversation,
                unreadCount: 0
              }
            : rawConversation;
        setSelectedConversation(conversation);
        const shouldHydrateCrmContext = !options?.background;
        const crmHydrationPromise =
          shouldHydrateCrmContext && conversation?.customerId
            ? Promise.all([loadCustomerCrmContext(conversation.customerId), loadConversationCrmContext(conversation.id)])
              : shouldHydrateCrmContext
              ? Promise.resolve().then(() => {
                  setTags([]);
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
      markConversationRead,
      orgId,
      setCrmActivity,
      setCrmInvoices,
      setError,
      setIsLoadingConversation,
      setMessages,
      setSelectedConversation,
      setSelectedConversationId,
      setSelectedProofMessageId,
      setTags
    ]
  );

  const loadConversations = useCallback(async (options?: { background?: boolean }) => {
    if (!orgId) {
      return;
    }
    const requestKey = `${orgId}::${filter}::${statusFilter}`;
    const isBackground = Boolean(options?.background);
    if (isBackground && Date.now() - lastBackgroundConversationsLoadAtRef.current < 1200) {
      return;
    }
    if (conversationsInFlightRef.current?.key === requestKey) {
      await conversationsInFlightRef.current.promise;
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
    const requestPromise = (async () => {
      try {
        const response = await fetch(
          `/api/conversations?filter=${encodeURIComponent(filter)}&status=${encodeURIComponent(statusFilter)}&page=1&limit=20&orgId=${encodeURIComponent(orgId)}`
        );
        const payload = (await response.json().catch(() => null)) as ListConversationsResponse | null;
        if (!response.ok) {
          if (response.status === 404 && payload?.error?.code === "ORG_NOT_FOUND") {
            setConversations([]);
            setMetaTotal(0);
            setSelectedConversationId(null);
            setSelectedConversation(null);
            setMessages([]);
            setSelectedProofMessageId(null);
            setTags([]);
            setCrmInvoices([]);
            setCrmActivity([]);
            return;
          }
          if (!options?.background) {
            setError(payload?.error?.message ?? "Failed to load conversations.");
          }
          return;
        }

        const incomingRows = payload?.data?.conversations ?? [];
        const rows = incomingRows.map((row) =>
          row.id === selectedConversationIdRef.current && row.unreadCount > 0
            ? {
                ...row,
                unreadCount: 0
              }
            : row
        );
        const nextUnreadTotal = rows.reduce((total, row) => total + row.unreadCount, 0);
        const currentSelectedConversationId = selectedConversationIdRef.current;
        const nextConversationId =
          currentSelectedConversationId && rows.some((row) => row.id === currentSelectedConversationId)
            ? currentSelectedConversationId
            : isConversationManuallyCleared
              ? null
              : rows[0]?.id ?? null;
        const nextSnapshot = JSON.stringify(
          rows.map((row) => ({
            id: row.id,
            unreadCount: row.unreadCount,
            lastMessageAt: row.lastMessageAt,
            lastMessageType: row.lastMessageType,
            lastMessageDirection: row.lastMessageDirection,
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
          setCrmInvoices([]);
          setCrmActivity([]);
          return;
        }

        setSelectedConversationId(nextConversationId);
        if (nextConversationId && (!options?.background || currentSelectedConversationId !== nextConversationId || selectedConversationChanged)) {
          void loadConversation(nextConversationId, options);
        }
      } catch {
        if (!options?.background) {
          setError("Network error while loading conversations.");
        }
      } finally {
        if (isBackground) {
          lastBackgroundConversationsLoadAtRef.current = Date.now();
        }
        if (conversationsInFlightRef.current?.key === requestKey) {
          conversationsInFlightRef.current = null;
        }
        isLoadingConversationsRef.current = false;
        if (!options?.background) {
          setIsLoadingList(false);
        }
      }
    })();

    conversationsInFlightRef.current = {
      key: requestKey,
      promise: requestPromise
    };
    await requestPromise;
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
    setSelectedConversation,
    setSelectedConversationId,
    setSelectedProofMessageId,
    setTags,
    statusFilter,
    isConversationManuallyCleared
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
      } finally {
        if (active) {
          setHasLoadedOrganizations(true);
        }
      }
    };

    void loadOrganizations();
    return () => {
      active = false;
    };
  }, [setError, setHasLoadedOrganizations, setOrgId, setOrganizations]);

  useEffect(() => {
    if (!hasLoadedOrganizations) {
      return;
    }
    void loadConversations();
  }, [hasLoadedOrganizations, loadConversations]);

  useEffect(() => {
    if (!hasLoadedOrganizations || !orgId) {
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
            const parsedTimestamp = new Date(payload.timestamp);
            const eventTs = Number.isNaN(parsedTimestamp.getTime()) ? new Date().toISOString() : parsedTimestamp.toISOString();
            const selectedId = selectedConversationIdRef.current;
            setConversations((previousRows) => {
              const targetIndex = previousRows.findIndex((row) => row.id === payload.conversationId);
              if (targetIndex < 0) {
                return previousRows;
              }

              const target = previousRows[targetIndex];
              const currentLastMessageAtMs = target.lastMessageAt ? new Date(target.lastMessageAt).getTime() : 0;
              const eventTsMs = Number.isNaN(parsedTimestamp.getTime()) ? Date.now() : parsedTimestamp.getTime();
              const nextUnreadCount =
                payload.direction === "INBOUND"
                  ? selectedId === payload.conversationId
                    ? 0
                    : target.unreadCount + 1
                  : target.unreadCount;

              const nextTarget = {
                ...target,
                status: "OPEN" as const,
                unreadCount: nextUnreadCount,
                lastMessageAt: eventTsMs >= currentLastMessageAtMs ? eventTs : target.lastMessageAt,
                updatedAt: eventTsMs >= currentLastMessageAtMs ? eventTs : target.updatedAt,
                lastMessageDirection: payload.direction
              };

              const nextRows = previousRows.filter((row) => row.id !== payload.conversationId);
              nextRows.unshift(nextTarget);
              recalculateConversationSnapshot(nextRows);
              return nextRows;
            });

            if (selectedId === payload.conversationId) {
              setTypingConversationId(null);
              setSelectedConversation((current) => {
                if (!current || current.id !== payload.conversationId) {
                  return current;
                }

                return {
                  ...current,
                  status: "OPEN",
                  unreadCount: 0,
                  lastMessageAt: eventTs,
                  updatedAt: eventTs,
                  lastMessageDirection: payload.direction
                };
              });
              void loadMessages(payload.conversationId, { background: true });
            }

            if (payload.direction === "INBOUND") {
              playInboundNotification();
            }
            scheduleRefresh();
          },
          onConversationUpdated: (payload) => {
            setConversations((previousRows) => {
              let changed = false;
              const nextRows = previousRows.map((row) => {
                if (row.id !== payload.conversationId) {
                  return row;
                }
                changed = true;
                return {
                  ...row,
                  status: payload.status,
                  assignedToMemberId: payload.assignedToMemberId,
                  updatedAt: payload.timestamp
                };
              });
              if (changed) {
                recalculateConversationSnapshot(nextRows);
              }
              return changed ? nextRows : previousRows;
            });
            setSelectedConversation((current) => {
              if (!current || current.id !== payload.conversationId) {
                return current;
              }
              return {
                ...current,
                status: payload.status,
                assignedToMemberId: payload.assignedToMemberId,
                updatedAt: payload.timestamp
              };
            });
            if (selectedConversationIdRef.current === payload.conversationId) {
              void loadMessages(payload.conversationId, { background: true });
            }
            scheduleRefresh();
          },
          onAssignmentChanged: (payload) => {
            setConversations((previousRows) => {
              let changed = false;
              const nextRows = previousRows.map((row) => {
                if (row.id !== payload.conversationId) {
                  return row;
                }
                changed = true;
                return {
                  ...row,
                  status: payload.status,
                  assignedToMemberId: payload.assignedToMemberId,
                  updatedAt: payload.timestamp
                };
              });
              if (changed) {
                recalculateConversationSnapshot(nextRows);
              }
              return changed ? nextRows : previousRows;
            });
            setSelectedConversation((current) => {
              if (!current || current.id !== payload.conversationId) {
                return current;
              }
              return {
                ...current,
                status: payload.status,
                assignedToMemberId: payload.assignedToMemberId,
                updatedAt: payload.timestamp
              };
            });
            if (selectedConversationIdRef.current === payload.conversationId) {
              void loadMessages(payload.conversationId, { background: true });
            }
            scheduleRefresh();
          },
          onConversationTyping: (payload) => {
            const timerKey = payload.conversationId;
            const existingTimer = typingResetTimersRef.current.get(timerKey);
            if (existingTimer) {
              clearTimeout(existingTimer);
              typingResetTimersRef.current.delete(timerKey);
            }

            if (payload.isTyping) {
              setTypingConversationId(payload.conversationId);
              const resetTimer = setTimeout(() => {
                setTypingConversationId((current) => (current === payload.conversationId ? null : current));
                typingResetTimersRef.current.delete(timerKey);
              }, 6500);
              typingResetTimersRef.current.set(timerKey, resetTimer);
              return;
            }

            setTypingConversationId((current) => (current === payload.conversationId ? null : current));
          },
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

      typingResetTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      typingResetTimersRef.current.clear();
    };
  }, [
    hasLoadedOrganizations,
    loadConversations,
    loadMessages,
    orgId,
    playInboundNotification,
    recalculateConversationSnapshot,
    setConversations,
    setSelectedConversation,
    setTypingConversationId
  ]);

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
