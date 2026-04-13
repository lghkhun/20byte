export function formatTimestamp(value: string | null, nowMs: number = Date.now()): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const now = new Date(nowMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const dateMs = date.getTime();
  if (dateMs >= todayStart && dateMs < tomorrowStart) {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  if (dateMs >= yesterdayStart && dateMs < todayStart) {
    return "Kemarin";
  }

  const diffDays = Math.floor((todayStart - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
  }

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    day: "2-digit"
  }).format(date);
}

export function getSourceBadge(source: string | null): { label: string; className: string; isMeta: boolean } | null {
  const normalizedSource = source?.trim().toLowerCase() ?? "";
  if (!normalizedSource || normalizedSource === "organic") {
    return null;
  }

  if (normalizedSource === "meta_ads" || normalizedSource === "meta") {
    return {
      label: "META",
      className:
        "inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300",
      isMeta: true
    };
  }

  return {
    label: normalizedSource.replace(/[_-]+/g, " ").trim().toUpperCase(),
    className: "rounded border border-border bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
    isMeta: false
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
