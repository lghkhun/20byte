"use client";

import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { Paperclip, Smile } from "lucide-react";

import { AttachmentPendingBar } from "@/components/inbox/input/AttachmentPendingBar";
import { isAllowedAttachmentType } from "@/components/inbox/input/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

type MessageInputProps = {
  density?: "compact" | "comfy";
  disabled: boolean;
  textValue: string;
  replyTarget?: { id: string; text: string } | null;
  onClearReplyTarget?: () => void;
  onTextValueChange: (nextValue: string) => void;
  onSendText: (text: string, options?: { replyToMessageId?: string | null; replyPreviewText?: string | null }) => Promise<void>;
  onSendAttachment: (attachment: {
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  }, options?: { replyToMessageId?: string | null }) => Promise<void>;
};

export function MessageInput({
  density = "comfy",
  disabled,
  textValue,
  replyTarget = null,
  onClearReplyTarget,
  onTextValueChange,
  onSendText,
  onSendAttachment
}: MessageInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  async function submitText() {
    const payload = textValue.trim();
    if (!payload || disabled) {
      return;
    }

    // Clear draft immediately so user can continue typing while previous message is in-flight.
    onTextValueChange("");
    try {
      await onSendText(payload, {
        replyToMessageId: replyTarget?.id ?? null,
        replyPreviewText: replyTarget?.text ?? null
      });
      onTextValueChange("");
      onClearReplyTarget?.();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch {
      // ignore; parent handles error feedback
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitText();
  }

  async function handleSendAttachment() {
    if (disabled || !pendingAttachment || isSendingAttachment) {
      return;
    }

    setAttachmentError(null);
    setIsSendingAttachment(true);
    try {
      await onSendAttachment(pendingAttachment, {
        replyToMessageId: replyTarget?.id ?? null
      });
      setPendingAttachment(null);
      onClearReplyTarget?.();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } finally {
      setIsSendingAttachment(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void submitText();
  }

  return (
    <form
      className={`space-y-2 border-t border-border/80 bg-card/95 backdrop-blur-sm ${density === "compact" ? "px-3 py-2 sm:px-4 sm:py-3" : "px-3 py-3 sm:px-4 sm:py-4"}`}
      onSubmit={handleSubmit}
    >
      {replyTarget ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Balas pesan</p>
            <p className="line-clamp-2 break-words text-xs text-foreground/90">{replyTarget.text}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearReplyTarget}>
            Batal
          </Button>
        </div>
      ) : null}
      <div
        className={`relative flex items-end gap-2 rounded-2xl border border-border bg-background/95 shadow-sm transition ${
          density === "compact" ? "px-2 py-1.5" : "px-2 py-2 sm:px-3 sm:py-2"
        }`}
      >
        <textarea
          ref={inputRef}
          value={textValue}
          onChange={(event) => onTextValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pesan..."
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-8 flex-1 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:outline-none"
        />
        <div className="flex items-center gap-1">
          <Button
            ref={emojiButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            title="Sisipkan emoji"
            onClick={() => {
              setIsEmojiOpen((current) => !current);
            }}
          >
            <Smile className="h-4 w-4" />
          </Button>
          <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              className="hidden"
              disabled={disabled || isSendingAttachment}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) {
                  return;
                }

                if (!isAllowedAttachmentType(file.type)) {
                  setAttachmentError("Tipe lampiran belum didukung.");
                  return;
                }

                setAttachmentError(null);
                setPendingAttachment({
                  file,
                  fileName: file.name,
                  mimeType: file.type || "application/octet-stream",
                  size: file.size
                });
              }}
            />
          </label>
        </div>
        <Button type="submit" disabled={disabled} className="h-9 rounded-xl px-4 shadow-md shadow-primary/20 sm:px-6">
          Kirim
        </Button>
        {isEmojiOpen ? (
          <div className="absolute bottom-[calc(100%_+_12px)] right-0 z-20 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <EmojiPicker
              lazyLoadEmojis
              emojiStyle={EmojiStyle.APPLE}
              theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
              onEmojiClick={(emojiData) => {
                onTextValueChange(`${textValue}${emojiData.emoji}`);
                setIsEmojiOpen(false);
                inputRef.current?.focus();
              }}
            />
          </div>
        ) : null}
      </div>

      {pendingAttachment ? (
        <AttachmentPendingBar
          pendingAttachment={pendingAttachment}
          disabled={disabled}
          isSendingAttachment={isSendingAttachment}
          onSend={() => {
            void handleSendAttachment();
          }}
          onRemove={() => {
            setPendingAttachment(null);
          }}
        />
      ) : null}

      {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
    </form>
  );
}
