import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

type StatePanelProps = {
  title?: string;
  message: string;
  action?: ReactNode;
};

export function EmptyStatePanel({ title = "No Data", message, action }: StatePanelProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/90 bg-background/40 px-4 py-5 text-center">
      <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80">
        <Inbox className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function LoadingStatePanel({ title = "Loading", message }: StatePanelProps) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-4 py-5 text-center">
      <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorStatePanel({ title = "Something went wrong", message, action }: StatePanelProps) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-5 text-center">
      <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <p className="text-sm font-medium text-destructive">{title}</p>
      <p className="mt-1 text-sm text-destructive/90">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
