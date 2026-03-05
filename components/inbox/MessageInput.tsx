"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MessageInputProps = {
  disabled: boolean;
  onSendText: (text: string) => Promise<void>;
};

export function MessageInput({ disabled, onSendText }: MessageInputProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

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

  return (
    <form className="space-y-2 rounded-xl border border-border bg-surface/70 p-3" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type message..."
          disabled={disabled || isSending}
        />
        <Button type="submit" disabled={disabled || isSending}>
          {isSending ? "Sending..." : "Send"}
        </Button>
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="rounded border border-border px-2 py-1">Attachment (next phase)</span>
        <span className="rounded border border-border px-2 py-1">Template (next phase)</span>
      </div>
    </form>
  );
}
