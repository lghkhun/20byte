#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const rootDir = process.cwd();

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return parseEnvFile(readFileSync(filePath, "utf8"));
}

function applyDefaults(target, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in target) && value !== undefined && value !== "") {
      target[key] = value;
    }
  }
}

const envFromFiles = {
  ...loadEnvFile(path.join(rootDir, ".env")),
  ...loadEnvFile(path.join(rootDir, ".env.local")),
};

const childEnv = {
  ...envFromFiles,
  ...process.env,
};

if (!childEnv.DATABASE_URL) {
  const mysqlUser = childEnv.MYSQL_USER || "app";
  const mysqlPassword = childEnv.MYSQL_PASSWORD || "";
  const mysqlDatabase = childEnv.MYSQL_DATABASE || "20byte";
  const mysqlPort = childEnv.MYSQL_PORT || "3307";
  childEnv.DATABASE_URL =
    `mysql://${mysqlUser}:${mysqlPassword}@127.0.0.1:${mysqlPort}/${mysqlDatabase}`;
}

if (!childEnv.REDIS_URL) {
  const redisPort = childEnv.REDIS_PORT || "6379";
  childEnv.REDIS_URL = `redis://127.0.0.1:${redisPort}`;
}

applyDefaults(childEnv, {
  NEXTAUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  SHORTLINK_BASE_URL: "http://localhost:3000/r",
});

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/run-with-local-env.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: rootDir,
  env: childEnv,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
