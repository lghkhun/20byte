import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

type OperationFeedbackProps = {
  tone: "success" | "error" | "info" | "loading";
  message: string;
  className?: string;
};

const TONE_CLASS: Record<OperationFeedbackProps["tone"], string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-border/70 bg-muted/50 text-muted-foreground",
  loading: "border-border/70 bg-muted/50 text-muted-foreground"
};

function ToneIcon({ tone }: Pick<OperationFeedbackProps, "tone">) {
  if (tone === "success") {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (tone === "error") {
    return <AlertTriangle className="h-4 w-4" />;
  }

  if (tone === "loading") {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  return <Info className="h-4 w-4" />;
}

export function OperationFeedback({ tone, message, className }: OperationFeedbackProps) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TONE_CLASS[tone]} ${className ?? ""}`.trim()}>
      <ToneIcon tone={tone} />
      <span>{message}</span>
    </p>
  );
}

