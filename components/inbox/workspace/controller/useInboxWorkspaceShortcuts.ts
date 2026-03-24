"use client";

import { useEffect } from "react";

type UseInboxWorkspaceShortcutsInput = {
  selectedConversationId: string | null;
  clearSelectedConversation: () => void;
  setIsQuickReplyModalOpen: (updater: boolean | ((current: boolean) => boolean)) => void;
  setIsShortcutHelpOpen: (updater: boolean | ((current: boolean) => boolean)) => void;
  goToNextUnassignedConversation: () => void;
  assignSelectedConversationToMe: () => Promise<void>;
  openInvoiceDrawer: () => void;
  openAttachProofShortcut: () => void;
};

export function useInboxWorkspaceShortcuts(input: UseInboxWorkspaceShortcutsInput) {
  const {
    selectedConversationId,
    clearSelectedConversation,
    setIsQuickReplyModalOpen,
    setIsShortcutHelpOpen,
    goToNextUnassignedConversation,
    assignSelectedConversationToMe,
    openInvoiceDrawer,
    openAttachProofShortcut
  } = input;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTypingTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable === true;
      if (isTypingTarget) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.ctrlKey && key === "/") {
        event.preventDefault();
        setIsShortcutHelpOpen((current) => !current);
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && key === "n") {
        event.preventDefault();
        goToNextUnassignedConversation();
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && key === "a") {
        event.preventDefault();
        void assignSelectedConversationToMe();
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && key === "i") {
        event.preventDefault();
        openInvoiceDrawer();
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && key === "/") {
        event.preventDefault();
        if (selectedConversationId) {
          setIsQuickReplyModalOpen(true);
        }
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && key === "p") {
        event.preventDefault();
        openAttachProofShortcut();
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && key === "escape" && selectedConversationId) {
        event.preventDefault();
        clearSelectedConversation();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    assignSelectedConversationToMe,
    clearSelectedConversation,
    goToNextUnassignedConversation,
    openAttachProofShortcut,
    openInvoiceDrawer,
    selectedConversationId,
    setIsQuickReplyModalOpen,
    setIsShortcutHelpOpen
  ]);
}
