export function issueRequestVersion(store: Map<string, number>, key: string): number {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    throw new Error("request key is required");
  }

  const nextVersion = (store.get(normalizedKey) ?? 0) + 1;
  store.set(normalizedKey, nextVersion);
  return nextVersion;
}

export function isRequestVersionCurrent(store: Map<string, number>, key: string, version: number): boolean {
  const normalizedKey = key.trim();
  if (!normalizedKey || !Number.isFinite(version)) {
    return false;
  }

  return (store.get(normalizedKey) ?? 0) === version;
}
