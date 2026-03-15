"use client";

import { type FormEvent, useRef, useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Paperclip, Smile } from "lucide-react";

import { AttachmentPendingBar } from "@/components/inbox/input/AttachmentPendingBar";
import { isAllowedAttachmentType } from "@/components/inbox/input/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";

type MessageInputProps = {
  density?: "compact" | "comfy";
  disabled: boolean;
  onSendText: (text: string) => Promise<void>;
  onSendAttachment: (attachment: {
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
};

export function MessageInput({ density = "comfy", disabled, onSendText, onSendAttachment }: MessageInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [inputHint, setInputHint] = useState<string | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = text.trim();
    if (!payload || disabled || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await onSendText(payload);
      setText("");
    } finally {
      setIsSending(false);
    }
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

  return (
    <form
      className={`space-y-3 border-t border-border/80 bg-card/95 backdrop-blur-sm ${density === "compact" ? "px-3 py-3 sm:px-4" : "px-3 py-3 sm:px-5 sm:py-4"}`}
      onSubmit={handleSubmit}
    >
      <div
        className={`relative flex items-center gap-2 rounded-2xl border border-border bg-background/95 shadow-sm transition ${
          density === "compact" ? "px-2 py-2" : "px-2 py-2.5 sm:px-3"
        }`}
      >
        <Input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Enter message..."
          disabled={disabled || isSending}
          className="h-8 border-0 bg-transparent p-0 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0"
        />
        <div className="flex items-center gap-1">
          <Button
            ref={emojiButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            title="Insert emoji"
            onClick={() => {
              setInputHint(null);
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
                  setAttachmentError("Attachment type is not supported.");
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
        <Button type="submit" disabled={disabled || isSending} className="h-9 rounded-xl px-3 shadow-sm sm:px-5">
          {isSending ? "Sending..." : "Send"}
        </Button>
        {isEmojiOpen ? (
          <div className="absolute bottom-[calc(100%_+_12px)] right-0 z-20 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <EmojiPicker
              lazyLoadEmojis
              theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
              onEmojiClick={(emojiData) => {
                setText((current) => `${current}${emojiData.emoji}`);
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
      {inputHint ? <p className="text-xs text-muted-foreground">{inputHint}</p> : null}

      <p className="text-[11px] text-muted-foreground/90">
        Tip: use <span className="font-medium text-foreground/90">/</span> for quick reply,{" "}
        <span className="font-medium text-foreground/90">I</span> for invoice drawer, and attach file with the paperclip icon.
      </p>
    </form>
  );
}
