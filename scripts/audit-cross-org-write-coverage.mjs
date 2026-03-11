#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, "server", "services");
const GUARD_TEST_FILE = path.join(ROOT, "tests", "unit", "crossOrgWriteGuard.test.ts");

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      result.push(fullPath);
    }
  }

  return result;
}

function toRepoRelative(absPath) {
  return path.relative(ROOT, absPath).replaceAll("\\", "/");
}

function scanServiceWriteFiles() {
  const files = walkFiles(SERVICES_DIR);
  const writeFiles = [];

  for (const absFile of files) {
    const source = fs.readFileSync(absFile, "utf8");
    if (!/\.(updateMany|deleteMany)\(/.test(source)) {
      continue;
    }

    writeFiles.push(toRepoRelative(absFile));
  }

  writeFiles.sort();
  return writeFiles;
}

function parseGuardMappedFiles() {
  const source = fs.readFileSync(GUARD_TEST_FILE, "utf8");
  const mapped = new Set();
  const regex = /file:\s*"([^"]+)"/g;
  for (const match of source.matchAll(regex)) {
    mapped.add(match[1]);
  }

  return mapped;
}

function main() {
  const writeFiles = scanServiceWriteFiles();
  const mappedFiles = parseGuardMappedFiles();

  const uncovered = writeFiles.filter((file) => !mappedFiles.has(file));
  const stale = Array.from(mappedFiles)
    .filter((file) => file.startsWith("server/services/"))
    .filter((file) => !writeFiles.includes(file))
    .sort();

  console.log("Cross-org write coverage audit");
  console.log(`- write-path service files: ${writeFiles.length}`);
  console.log(`- mapped in crossOrgWriteGuard: ${mappedFiles.size}`);

  if (uncovered.length === 0) {
    console.log("- uncovered write-path files: 0");
  } else {
    console.log(`- uncovered write-path files: ${uncovered.length}`);
    for (const file of uncovered) {
      console.log(`  - ${file}`);
    }
  }

  if (stale.length > 0) {
    console.log(`- stale mapped files (no updateMany/deleteMany found): ${stale.length}`);
    for (const file of stale) {
      console.log(`  - ${file}`);
    }
  }

  if (uncovered.length > 0) {
    process.exitCode = 1;
  }
}

main();
