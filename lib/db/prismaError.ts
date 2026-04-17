export function isPrismaDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("cant reach database server") ||
    message.includes("p1001") ||
    message.includes("connection refused") ||
    message.includes("connect econnrefused")
  );
}

