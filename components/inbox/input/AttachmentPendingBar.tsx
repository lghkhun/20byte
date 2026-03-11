import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/components/inbox/input/utils";

type PendingAttachment = {
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
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
      <p className="truncate text-foreground">
        {pendingAttachment.fileName} ({formatFileSize(pendingAttachment.size)})
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" className="h-7 px-2 text-xs" disabled={disabled || isSendingAttachment} onClick={onSend}>
          {isSendingAttachment ? "Sending..." : "Send attachment"}
        </Button>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
