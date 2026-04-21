"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { CalendarDays, CalendarIcon, Paperclip, Smile } from "lucide-react";

import { ImageAttachmentEditorModal } from "@/components/inbox/input/ImageAttachmentEditorModal";
import { VideoAttachmentEditorModal } from "@/components/inbox/input/VideoAttachmentEditorModal";
import { isAllowedAttachmentType } from "@/components/inbox/input/utils";
import { dismissNotify, notifyError, notifyLoading } from "@/lib/ui/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";

type MessageInputProps = {
  density?: "compact" | "comfy";
  disabled: boolean;
  focusKey?: string | null;
  textValue: string;
  replyTarget?: { id: string; text: string; author?: string | null } | null;
  onClearReplyTarget?: () => void;
  onTextValueChange: (nextValue: string) => void;
  onSendText: (
    text: string,
    options?: { replyToMessageId?: string | null; replyPreviewText?: string | null; scheduleAt?: string | null }
  ) => Promise<{ scheduledDueAt?: string | null } | void>;
  onSendAttachment: (attachment: {
    file: File;
    fileName: string;
    mimeType: string;
    size: number;
  }, options?: { replyToMessageId?: string | null; text?: string | null }) => Promise<void>;
};

export function MessageInput({
  density = "comfy",
  disabled,
  focusKey = null,
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
  const [isScheduleMenuOpen, setIsScheduleMenuOpen] = useState(false);
  const [isCustomScheduleOpen, setIsCustomScheduleOpen] = useState(false);
  const [isCustomDatePopoverOpen, setIsCustomDatePopoverOpen] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState<Date | undefined>(undefined);
  const [customScheduleHour, setCustomScheduleHour] = useState("09");
  const [customScheduleMinute, setCustomScheduleMinute] = useState("00");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isVideoEditorOpen, setIsVideoEditorOpen] = useState(false);
  const [attachmentText, setAttachmentText] = useState("");
  const attachmentLoadingToastIdRef = useRef<string | number | null>(null);

  async function sendAttachmentNow(
    attachment: {
      file: File;
      fileName: string;
      mimeType: string;
      size: number;
    },
    options?: {
      text?: string | null;
      clearComposerText?: boolean;
      clearAttachmentText?: boolean;
    }
  ) {
    if (disabled || isSendingAttachment) {
      return;
    }

    setAttachmentError(null);
    setIsSendingAttachment(true);
    attachmentLoadingToastIdRef.current = notifyLoading("Mengirim lampiran...", {
      id: "inbox-attachment-send-loading"
    });
    try {
      await onSendAttachment(attachment, {
        replyToMessageId: replyTarget?.id ?? null,
        text: options?.text ?? null
      });
      if (options?.clearComposerText) {
        onTextValueChange("");
      }
      if (options?.clearAttachmentText) {
        setAttachmentText("");
      }
      setPendingAttachment(null);
      onClearReplyTarget?.();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch {
      setAttachmentError("Gagal mengirim lampiran.");
      notifyError("Gagal mengirim lampiran.");
    } finally {
      if (attachmentLoadingToastIdRef.current !== null) {
        dismissNotify(attachmentLoadingToastIdRef.current);
        attachmentLoadingToastIdRef.current = null;
      }
      setIsSendingAttachment(false);
    }
  }

  useEffect(() => {
    if (disabled || !focusKey || isImageEditorOpen || isVideoEditorOpen) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      const valueLength = inputRef.current?.value?.length ?? 0;
      inputRef.current?.setSelectionRange(valueLength, valueLength);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [disabled, focusKey, isImageEditorOpen, isVideoEditorOpen]);

  function applyPendingFile(file: File) {
    if (!isAllowedAttachmentType(file.type)) {
      setAttachmentError("Tipe lampiran belum didukung.");
      return;
    }

    setAttachmentError(null);
    const nextAttachment = {
      file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size
    };
    setPendingAttachment(nextAttachment);

    if (file.type.startsWith("image/")) {
      setIsImageEditorOpen(true);
      return;
    }
    if (file.type.startsWith("video/")) {
      setIsVideoEditorOpen(true);
      return;
    }

    void sendAttachmentNow(nextAttachment, {
      text: textValue.trim() || null,
      clearComposerText: Boolean(textValue.trim()),
      clearAttachmentText: true
    });
  }

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

  function formatCustomSchedulePreview(date: Date | undefined, hour: string, minute: string): string {
    if (!date) {
      return "Pilih tanggal";
    }

    const next = new Date(date);
    next.setHours(Number(hour), Number(minute), 0, 0);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(next);
  }

  function resolvePresetSchedule(preset: "tomorrow_08" | "tomorrow_13" | "next_monday_08"): Date {
    const now = new Date();
    if (preset === "tomorrow_08" || preset === "tomorrow_13") {
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(preset === "tomorrow_08" ? 8 : 13, 0, 0, 0);
      return target;
    }

    const currentDay = now.getDay(); // 0 = Minggu, 1 = Senin
    const daysUntilMonday = ((8 - currentDay) % 7) || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(8, 0, 0, 0);
    return nextMonday;
  }

  async function submitScheduledText(scheduleAtIso: string) {
    const payload = textValue.trim();
    if (!payload || disabled || isScheduling) {
      return;
    }

    setIsScheduling(true);
    onTextValueChange("");
    try {
      await onSendText(payload, {
        replyToMessageId: replyTarget?.id ?? null,
        replyPreviewText: replyTarget?.text ?? null,
        scheduleAt: scheduleAtIso
      });
      onTextValueChange("");
      onClearReplyTarget?.();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch {
      notifyError("Gagal menjadwalkan pesan. Coba lagi.");
      onTextValueChange(payload);
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitText();
  }

  function resizeComposerTextarea() {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const maxHeight = lineHeight * 6;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
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

  useEffect(() => {
    resizeComposerTextarea();
  }, [textValue]);

  return (
    <form
      className={`space-y-2 border-t border-border/70 bg-card/95 backdrop-blur-sm ${
        density === "compact" ? "px-2 py-2 sm:px-4 sm:py-3" : "px-2 py-2.5 sm:px-4 sm:py-4"
      }`}
      onSubmit={handleSubmit}
    >
      {replyTarget ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-primary">{replyTarget.author?.trim() || "Penulis pesan"}</p>
            <p className="line-clamp-2 break-words text-xs text-foreground/90">{replyTarget.text}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearReplyTarget}>
            Batal
          </Button>
        </div>
      ) : null}
      <div
        className={`relative flex items-end gap-1.5 rounded-2xl border border-border bg-background/95 shadow-sm transition ${
          density === "compact" ? "px-2 py-1.5" : "px-2 py-2 sm:px-3"
        }`}
      >
        <textarea
          ref={inputRef}
          value={textValue}
          onChange={(event) => {
            onTextValueChange(event.target.value);
            resizeComposerTextarea();
          }}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const items = Array.from(event.clipboardData?.items ?? []);
            const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
            if (!imageItem) {
              return;
            }
            const file = imageItem.getAsFile();
            if (!file) {
              return;
            }
            event.preventDefault();
            applyPendingFile(file);
          }}
          placeholder="Ketik pesan..."
          disabled={disabled}
          rows={1}
          className="min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:outline-none sm:text-sm sm:py-0 sm:min-h-8"
        />
        <div className="flex items-center gap-0.5 pb-1 sm:gap-1">
          {/* Schedule button — hidden on mobile to save space */}
          <DropdownMenu open={isScheduleMenuOpen} onOpenChange={setIsScheduleMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 rounded-lg text-muted-foreground sm:flex"
                title="Jadwalkan pengiriman"
                disabled={disabled || !textValue.trim() || isScheduling}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]">
              <DropdownMenuLabel>Jadwalkan pengiriman</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => {
                  void submitScheduledText(resolvePresetSchedule("tomorrow_08").toISOString());
                }}
              >
                Besok pukul 08.00
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void submitScheduledText(resolvePresetSchedule("tomorrow_13").toISOString());
                }}
              >
                Besok pukul 13.00
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void submitScheduledText(resolvePresetSchedule("next_monday_08").toISOString());
                }}
              >
                Senin berikutnya pukul 08.00
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  const fallback = new Date();
                  fallback.setMinutes(fallback.getMinutes() + 30);
                  fallback.setSeconds(0, 0);
                  const roundedMinute = fallback.getMinutes() >= 30 ? 30 : 0;
                  fallback.setMinutes(roundedMinute, 0, 0);
                  setCustomScheduleDate(fallback);
                  setCustomScheduleHour(String(fallback.getHours()).padStart(2, "0"));
                  setCustomScheduleMinute(String(fallback.getMinutes()).padStart(2, "0"));
                  setIsCustomScheduleOpen(true);
                }}
              >
                Pilih waktu kustom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            ref={emojiButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-muted-foreground"
            title="Sisipkan emoji"
            onClick={() => {
              setIsEmojiOpen((current) => !current);
            }}
          >
            <Smile className="h-4 w-4" />
          </Button>
          <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
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
                applyPendingFile(file);
              }}
            />
          </label>
        </div>
        <Button type="submit" disabled={disabled} className="h-10 rounded-xl px-4 font-semibold shadow-md shadow-primary/20 sm:h-9 sm:px-5">
          Kirim
        </Button>
        {isEmojiOpen ? (
          <div className="absolute bottom-[calc(100%_+_12px)] right-0 z-20 max-w-[min(340px,100vw-16px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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

      {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}

      <ImageAttachmentEditorModal
        open={isImageEditorOpen}
        file={pendingAttachment && pendingAttachment.mimeType.startsWith("image/") ? pendingAttachment.file : null}
        captionText={attachmentText}
        onCaptionTextChange={setAttachmentText}
        onCancel={() => {
          setIsImageEditorOpen(false);
          setPendingAttachment(null);
          setAttachmentText("");
        }}
        onApply={async (editedFile) => {
          const nextAttachment = {
            file: editedFile,
            fileName: editedFile.name,
            mimeType: editedFile.type || "application/octet-stream",
            size: editedFile.size
          };

          setAttachmentError(null);
          setIsImageEditorOpen(false);
          await sendAttachmentNow(nextAttachment, {
            text: attachmentText.trim() || null,
            clearAttachmentText: true
          });
        }}
      />
      <VideoAttachmentEditorModal
        open={isVideoEditorOpen}
        file={pendingAttachment && pendingAttachment.mimeType.startsWith("video/") ? pendingAttachment.file : null}
        captionText={attachmentText}
        onCaptionTextChange={setAttachmentText}
        onCancel={() => {
          setIsVideoEditorOpen(false);
          setPendingAttachment(null);
          setAttachmentText("");
        }}
        onApply={async (trimmedFile) => {
          const nextAttachment = {
            file: trimmedFile,
            fileName: trimmedFile.name,
            mimeType: trimmedFile.type || "video/webm",
            size: trimmedFile.size
          };

          setAttachmentError(null);
          setIsVideoEditorOpen(false);
          await sendAttachmentNow(nextAttachment, {
            text: attachmentText.trim() || null,
            clearAttachmentText: true
          });
        }}
      />

      <Dialog open={isCustomScheduleOpen} onOpenChange={setIsCustomScheduleOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Jadwalkan pengiriman</DialogTitle>
            <DialogDescription>Pilih tanggal & jam kirim pesan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Popover open={isCustomDatePopoverOpen} onOpenChange={setIsCustomDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-between rounded-xl border-border text-left font-normal"
                >
                  <span className="truncate">{formatCustomSchedulePreview(customScheduleDate, customScheduleHour, customScheduleMinute)}</span>
                  <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={customScheduleDate}
                  onSelect={(date) => {
                    setCustomScheduleDate(date);
                    setIsCustomDatePopoverOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Jam</p>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={customScheduleHour}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, "").slice(0, 2);
                    if (!raw) {
                      setCustomScheduleHour("");
                      return;
                    }
                    const value = Math.max(0, Math.min(23, Number(raw)));
                    setCustomScheduleHour(String(value).padStart(2, "0"));
                  }}
                  className="h-10 rounded-lg"
                  placeholder="08"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Menit</p>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={customScheduleMinute}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, "").slice(0, 2);
                    if (!raw) {
                      setCustomScheduleMinute("");
                      return;
                    }
                    const value = Math.max(0, Math.min(59, Number(raw)));
                    setCustomScheduleMinute(String(value).padStart(2, "0"));
                  }}
                  className="h-10 rounded-lg"
                  placeholder="00"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsCustomScheduleOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!customScheduleDate) {
                    notifyError("Tanggal kirim wajib dipilih.");
                    return;
                  }
                  if (customScheduleHour === "" || customScheduleMinute === "") {
                    notifyError("Jam dan menit wajib diisi.");
                    return;
                  }
                  const hour = Number(customScheduleHour);
                  const minute = Number(customScheduleMinute);
                  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
                    notifyError("Jam harus di antara 00-23.");
                    return;
                  }
                  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
                    notifyError("Menit harus di antara 00-59.");
                    return;
                  }

                  const parsed = new Date(customScheduleDate);
                  parsed.setHours(hour, minute, 0, 0);
                  if (Number.isNaN(parsed.getTime())) {
                    notifyError("Format waktu tidak valid.");
                    return;
                  }
                  if (parsed.getTime() <= Date.now()) {
                    notifyError("Waktu kirim harus lebih dari waktu sekarang.");
                    return;
                  }
                  setIsCustomScheduleOpen(false);
                  void submitScheduledText(parsed.toISOString());
                }}
                disabled={!customScheduleDate || customScheduleHour === "" || customScheduleMinute === "" || isScheduling}
              >
                {isScheduling ? "Menjadwalkan..." : "Jadwalkan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
