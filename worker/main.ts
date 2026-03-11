import { startWorker, stopWorker } from "./index";

async function main() {
  await startWorker();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker startup error";
  console.error(`[worker] startup failed: ${message}`);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down...`);
  stopWorker();
  setTimeout(() => {
    process.exit(0);
  }, 250);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
