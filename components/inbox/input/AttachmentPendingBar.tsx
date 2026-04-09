import { useEffect, useMemo, useState } from "react";
import { FileText, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/components/inbox/input/utils";

type PendingAttachment = {
  file: File;
  fileName: string;
  mimeType: string;
  size: number;
};

type AttachmentPendingBarProps = {
  pendingAttachment: PendingAttachment;
  disabled: boolean;
  isSendingAttachment: boolean;
  onSend: () => void;
  onRemove: () => void;
};

export function AttachmentPendingBar({
  pendingAttachment,
  disabled,
  isSendingAttachment,
  onSend,
  onRemove
}: AttachmentPendingBarProps) {
  const [failed, setFailed] = useState(false);
  const objectUrl = useMemo(() => URL.createObjectURL(pendingAttachment.file), [pendingAttachment.file]);
  const isImage = pendingAttachment.mimeType.startsWith("image/");
  const isVideo = pendingAttachment.mimeType.startsWith("video/");

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/55 p-2.5 text-xs">
      {isImage ? (
        <img
          src={objectUrl}
          alt={pendingAttachment.fileName}
          className="max-h-[320px] w-auto max-w-[min(70vw,340px)] rounded-lg border border-border object-contain"
          onError={() => setFailed(true)}
        />
      ) : null}
      {isVideo ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-black/80">
          <video controls preload="metadata" className="max-h-[320px] w-auto max-w-[min(70vw,340px)] object-contain" onError={() => setFailed(true)}>
            <source src={objectUrl} type={pendingAttachment.mimeType} />
          </video>
          {!failed ? (
            <div className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <PlayCircle className="h-3 w-3" />
              VIDEO
            </div>
          ) : null}
        </div>
      ) : null}
      {!isImage && !isVideo ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card/70 px-2.5 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="truncate text-foreground">
            {pendingAttachment.fileName} ({formatFileSize(pendingAttachment.size)})
          </p>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-foreground/85">
          {pendingAttachment.fileName} ({formatFileSize(pendingAttachment.size)})
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" className="h-7 rounded-lg px-2.5 text-xs" disabled={disabled || isSendingAttachment} onClick={onSend}>
            {isSendingAttachment ? "Mengirim..." : "Kirim"}
          </Button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onRemove}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
