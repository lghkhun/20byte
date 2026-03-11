"use client";

import { type FormEvent, useRef, useState } from "react";
import { Mic, Paperclip, Smile } from "lucide-react";

import { AttachmentPendingBar } from "@/components/inbox/input/AttachmentPendingBar";
import { TemplateComposer } from "@/components/inbox/input/TemplateComposer";
import { isAllowedAttachmentType } from "@/components/inbox/input/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MessageInputProps = {
  density?: "compact" | "comfy";
  disabled: boolean;
  onSendText: (text: string) => Promise<void>;
  onSendAttachment: (attachment: {
    fileName: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
  onSendTemplate: (input: {
    templateName: string;
    templateCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
    templateLanguageCode: string;
  }) => Promise<void>;
};

export function MessageInput({ density = "comfy", disabled, onSendText, onSendAttachment, onSendTemplate }: MessageInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    fileName: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE">("UTILITY");
  const [templateLanguageCode, setTemplateLanguageCode] = useState("en");
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [inputHint, setInputHint] = useState<string | null>(null);

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

  async function handleSendTemplate() {
    if (disabled || isSendingTemplate) {
      return;
    }

    const normalizedName = templateName.trim();
    const normalizedLanguage = templateLanguageCode.trim() || "en";
    if (!normalizedName) {
      return;
    }

    setIsSendingTemplate(true);
    try {
      await onSendTemplate({
        templateName: normalizedName,
        templateCategory,
        templateLanguageCode: normalizedLanguage
      });
      setTemplateName("");
    } finally {
      setIsSendingTemplate(false);
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
        className={`flex items-center gap-2 rounded-2xl border border-border bg-background/95 shadow-sm transition ${
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
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            title="Insert emoji"
            onClick={() => {
              setText((current) => `${current}${current.trim().length > 0 ? " " : ""}🙂`);
              setInputHint(null);
              inputRef.current?.focus();
            }}
          >
            <Smile className="h-4 w-4" />
          </Button>
          <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*,application/pdf"
              disabled={disabled || isSendingAttachment}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) {
                  return;
                }

                if (!isAllowedAttachmentType(file.type)) {
                  setAttachmentError("Attachment must be image, PDF, or video.");
                  return;
                }

                setAttachmentError(null);
                setPendingAttachment({
                  fileName: file.name,
                  mimeType: file.type || "application/octet-stream",
                  size: file.size
                });
              }}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            title="Voice note shortcut"
            onClick={() => {
              setInputHint("Voice note recorder is in progress. Please use attachment or text for now.");
              inputRef.current?.focus();
            }}
          >
            <Mic className="h-4 w-4" />
          </Button>
        </div>
        <Button type="submit" disabled={disabled || isSending} className="h-9 rounded-xl px-3 shadow-sm sm:px-5">
          {isSending ? "Sending..." : "Send"}
        </Button>
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

      <TemplateComposer
        density={density}
        disabled={disabled}
        isSendingTemplate={isSendingTemplate}
        templateName={templateName}
        templateCategory={templateCategory}
        templateLanguageCode={templateLanguageCode}
        onTemplateNameChange={setTemplateName}
        onTemplateCategoryChange={setTemplateCategory}
        onTemplateLanguageCodeChange={setTemplateLanguageCode}
        onSendTemplate={() => {
          void handleSendTemplate();
        }}
      />

      <p className="text-[11px] text-muted-foreground/90">
        Tip: use <span className="font-medium text-foreground/90">/</span> for quick reply,{" "}
        <span className="font-medium text-foreground/90">I</span> for invoice drawer, and{" "}
        <span className="font-medium text-foreground/90">Ctrl+/</span> for shortcuts help.
      </p>
    </form>
  );
}
