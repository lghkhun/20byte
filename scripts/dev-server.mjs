#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import path from "node:path";

const rootDir = process.cwd();
const nextCacheDir = path.join(rootDir, ".next", "cache");
const DEV_PORT = 3000;

function readCmdline(pid) {
  try {
    const raw = readFileSync(`/proc/${pid}/cmdline`);
    return raw.toString().replace(/\u0000/g, " ").trim();
  } catch {
    return "";
  }
}

function readParentPid(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const match = status.match(/^PPid:\s+(\d+)$/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function findListeningPid(port) {
  try {
    const output = execSync("ss -ltnp", { encoding: "utf8" });
    const lines = output.split("\n").filter((line) => line.includes(`:${port} `));
    for (const line of lines) {
      const match = line.match(/pid=(\d+)/);
      if (match) {
        return Number(match[1]);
      }
    }
  } catch {
    // Ignore, we'll fallback to normal start path.
  }
  return null;
}

function collectProcessChain(startPid, maxDepth = 4) {
  const chain = [];
  let currentPid = startPid;
  let depth = 0;
  while (currentPid && depth < maxDepth) {
    chain.push({
      pid: currentPid,
      cmdline: readCmdline(currentPid)
    });
    currentPid = readParentPid(currentPid);
    depth += 1;
  }
  return chain;
}

function terminateProcess(pid) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // No-op if already dead.
  }
}

function freePortIfStaleNext(port) {
  const listenerPid = findListeningPid(port);
  if (!listenerPid) {
    return;
  }

  const processChain = collectProcessChain(listenerPid);
  const devOwner = processChain.find((item) => item.cmdline.includes("next dev") && item.cmdline.includes(rootDir));
  const listener = processChain[0];

  if (devOwner) {
    process.stdout.write(`Port ${port} is used by stale Next dev process (pid ${devOwner.pid}). Stopping it.\n`);
    terminateProcess(devOwner.pid);
    return;
  }

  if (listener?.cmdline.includes("next-server")) {
    process.stdout.write(`Port ${port} is used by stale Next server process (pid ${listener.pid}). Stopping it.\n`);
    terminateProcess(listener.pid);
    return;
  }

  const ownerSummary = listener?.cmdline || `pid ${listenerPid}`;
  process.stderr.write(`Port ${port} is already used by another process: ${ownerSummary}\n`);
  process.stderr.write(`Please stop that process first, then retry.\n`);
  process.exit(1);
}

if (existsSync(nextCacheDir)) {
  rmSync(nextCacheDir, { recursive: true, force: true });
  process.stdout.write("Cleared .next/cache before starting dev server.\n");
}

freePortIfStaleNext(DEV_PORT);

const child = spawn("next", ["dev", "-p", String(DEV_PORT)], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
