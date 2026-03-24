"use client";

import { useEffect, useMemo, useState } from "react";

type LocalImageCacheEntry = {
  source: string;
  dataUrl: string;
  expiresAt: number;
};

type UseLocalImageCacheOptions = {
  cacheKey?: string;
  ttlMs?: number;
  maxBytes?: number;
  enabled?: boolean;
};

const CACHE_PREFIX = "imgcache:v1:";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 350 * 1024;

const memoryCache = new Map<string, LocalImageCacheEntry>();
const inflightCache = new Map<string, Promise<string | null>>();

function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

function resolveStorageKey(cacheKey: string): string {
  return `${CACHE_PREFIX}${cacheKey}`;
}

function readFromStorage(storageKey: string): LocalImageCacheEntry | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (memoryCache.has(storageKey)) {
    return memoryCache.get(storageKey) ?? null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as LocalImageCacheEntry;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (typeof parsed.source !== "string" || typeof parsed.dataUrl !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }

    memoryCache.set(storageKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(storageKey: string, entry: LocalImageCacheEntry): void {
  memoryCache.set(storageKey, entry);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch {
    // no-op: quota or storage access blocked
  }
}

function removeStorageKey(storageKey: string): void {
  memoryCache.delete(storageKey);
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // no-op
  }
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image as data URL."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

async function fetchDataUrl(source: string, maxBytes: number): Promise<string | null> {
  const response = await fetch(source, {
    method: "GET",
    cache: "force-cache",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.size || blob.size > maxBytes) {
    return null;
  }

  return fileToDataUrl(blob);
}

export function invalidateLocalImageCache(cacheKeyPrefix?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!cacheKeyPrefix) {
    memoryCache.clear();
    inflightCache.clear();
    try {
      const keysToDelete: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // no-op
    }
    return;
  }

  const targetPrefix = resolveStorageKey(cacheKeyPrefix);
  for (const key of memoryCache.keys()) {
    if (key.startsWith(targetPrefix)) {
      memoryCache.delete(key);
    }
  }
  for (const key of inflightCache.keys()) {
    if (key.startsWith(targetPrefix)) {
      inflightCache.delete(key);
    }
  }

  try {
    const keysToDelete: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(targetPrefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // no-op
  }
}

export function useLocalImageCache(source: string | null | undefined, options?: UseLocalImageCacheOptions): string | undefined {
  const normalizedSource = source?.trim() || "";
  const [resolvedSource, setResolvedSource] = useState<string | undefined>(normalizedSource || undefined);
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const enabled = options?.enabled ?? true;

  const cacheKey = useMemo(() => {
    if (!normalizedSource) {
      return null;
    }
    if (isDataUrl(normalizedSource)) {
      return null;
    }
    return options?.cacheKey ?? normalizedSource;
  }, [normalizedSource, options?.cacheKey]);

  useEffect(() => {
    if (!normalizedSource) {
      setResolvedSource(undefined);
      return;
    }

    if (isDataUrl(normalizedSource) || !enabled) {
      setResolvedSource(normalizedSource);
      return;
    }

    if (typeof window === "undefined" || !cacheKey) {
      setResolvedSource(normalizedSource);
      return;
    }

    const storageKey = resolveStorageKey(cacheKey);
    const now = Date.now();
    const cached = readFromStorage(storageKey);
    if (cached && cached.source === normalizedSource && cached.expiresAt > now) {
      setResolvedSource(cached.dataUrl);
      return;
    }

    if (cached && cached.expiresAt <= now) {
      removeStorageKey(storageKey);
    }

    setResolvedSource(normalizedSource);

    let active = true;
    const inflightKey = `${storageKey}::${normalizedSource}`;
    const inflight = inflightCache.get(inflightKey) ?? fetchDataUrl(normalizedSource, maxBytes);
    inflightCache.set(inflightKey, inflight);

    void inflight
      .then((dataUrl) => {
        if (!active || !dataUrl) {
          return;
        }

        const entry: LocalImageCacheEntry = {
          source: normalizedSource,
          dataUrl,
          expiresAt: Date.now() + ttlMs
        };
        writeToStorage(storageKey, entry);
        setResolvedSource(dataUrl);
      })
      .catch(() => {
        if (active) {
          setResolvedSource(normalizedSource);
        }
      })
      .finally(() => {
        inflightCache.delete(inflightKey);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, enabled, maxBytes, normalizedSource, ttlMs]);

  return resolvedSource || undefined;
}

