export function formatTimestamp(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit"
  }).format(date);
}

export function getSourceBadge(source: string | null): { label: string; className: string } {
  if (source === "meta_ads") {
    return {
      label: "META",
      className:
        "rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300"
    };
  }

  return {
    label: "ORGANIC",
    className: "rounded border border-border bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
  };
}

export function toInitials(name: string | null, phone: string): string {
  const trimmedName = (name ?? "").trim();
  if (!trimmedName) {
    return phone.replace(/\D/g, "").slice(-2) || "NA";
  }

  const parts = trimmedName.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "NA";
}

export function toAvatarTone(seed: string): string {
  const tones = [
    "bg-rose-500/20 text-rose-700 dark:text-rose-300",
    "bg-sky-500/20 text-sky-700 dark:text-sky-300",
    "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    "bg-violet-500/20 text-violet-700 dark:text-violet-300",
    "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
  ];

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return tones[hash % tones.length];
}
