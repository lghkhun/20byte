"use client";

import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Paperclip, Smile } from "lucide-react";

import { AttachmentPendingBar } from "@/components/inbox/input/AttachmentPendingBar";
import { isAllowedAttachmentType } from "@/components/inbox/input/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

type MessageInputProps = {
  density?: "compact" | "comfy";
  disabled: boolean;
  textValue: string;
  onTextValueChange: (nextValue: string) => void;
  onSendText: (text: string) => Promise<void>;
  onSendAttachment: (attachment: {
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
};

export function MessageInput({
  density = "comfy",
  disabled,
  textValue,
  onTextValueChange,
  onSendText,
  onSendAttachment
}: MessageInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [isSending, setIsSending] = useState(false);
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
    if (!payload || disabled || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await onSendText(payload);
      onTextValueChange("");
    } finally {
      setIsSending(false);
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
      await onSendAttachment(pendingAttachment);
      setPendingAttachment(null);
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
      className={`space-y-3 border-t border-border/80 bg-card/95 backdrop-blur-sm ${density === "compact" ? "px-3 py-3 sm:px-4" : "px-3 py-3 sm:px-5 sm:py-4"}`}
      onSubmit={handleSubmit}
    >
      <div
        className={`relative flex items-end gap-2 rounded-2xl border border-border bg-background/95 shadow-sm transition ${
          density === "compact" ? "px-2 py-2" : "px-2 py-2.5 sm:px-3"
        }`}
      >
        <textarea
          ref={inputRef}
          value={textValue}
          onChange={(event) => onTextValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pesan..."
          disabled={disabled || isSending}
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
        <Button type="submit" disabled={disabled || isSending} className="h-9 rounded-xl px-4 shadow-md shadow-primary/20 sm:px-6">
          {isSending ? "Mengirim..." : "Kirim"}
        </Button>
        {isEmojiOpen ? (
          <div className="absolute bottom-[calc(100%_+_12px)] right-0 z-20 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <EmojiPicker
              lazyLoadEmojis
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

      <p className="text-[11px] text-muted-foreground">`Enter` untuk kirim, `Shift + Enter` untuk baris baru.</p>

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
