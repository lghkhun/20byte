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

export function toDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayLabel(dayKey: string): string {
  if (dayKey === "unknown") {
    return "Unknown date";
  }

  const [year, month, day] = dayKey.split("-").map((part) => Number(part));
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}
