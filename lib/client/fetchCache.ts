type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type FetchJsonCachedOptions = {
  ttlMs?: number;
  init?: RequestInit;
  key?: string;
};

const DEFAULT_TTL_MS = 10_000;

const responseCache = new Map<string, CacheEntry>();
const inflightCache = new Map<string, Promise<unknown>>();

function normalizeMethod(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

function resolveCacheKey(url: string, options?: FetchJsonCachedOptions): string {
  if (options?.key) {
    return options.key;
  }

  const method = normalizeMethod(options?.init);
  return `${method}:${url}`;
}

export function invalidateFetchCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    responseCache.clear();
    inflightCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      responseCache.delete(key);
    }
  }

  for (const key of inflightCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      inflightCache.delete(key);
    }
  }
}

export async function fetchJsonCached<T>(url: string, options?: FetchJsonCachedOptions): Promise<T> {
  const method = normalizeMethod(options?.init);
  const cacheKey = resolveCacheKey(url, options);
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  if (method === "GET") {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const inflight = inflightCache.get(cacheKey);
    if (inflight) {
      return (await inflight) as T;
    }
  }

  const request = (async () => {
    const response = await fetch(url, options?.init);
    const payload = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? payload.error?.message ?? `Request failed with status ${response.status}`
          : `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return payload as T;
  })();

  if (method === "GET") {
    inflightCache.set(cacheKey, request);
  }

  try {
    const result = await request;
    if (method === "GET") {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        value: result
      });
    }
    return result;
  } finally {
    if (method === "GET") {
      inflightCache.delete(cacheKey);
    }
  }
}
