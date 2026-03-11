type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeDelay(attempt: number, options: RetryOptions): number {
  const factor = options.factor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const raw = Math.min(maxDelayMs, Math.floor(options.baseDelayMs * Math.pow(factor, attempt - 1)));
  if (!options.jitter) {
    return raw;
  }

  const jitterRange = Math.floor(raw * 0.2);
  const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
  return Math.max(0, raw + jitter);
}

export async function withRetry<T>(
  label: string,
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= options.retries) {
        break;
      }

      const delayMs = computeDelay(attempt, options);
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[retry] ${label} attempt ${attempt} failed: ${message}. Retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`[retry] ${label} failed after retries.`);
}
