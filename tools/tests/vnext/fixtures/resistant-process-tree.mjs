#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [, , pidFile, depthText = "0"] = process.argv;
if (!pidFile) throw new Error("PID file path is required");

const depth = Number(depthText);
appendFileSync(pidFile, `${process.pid}\n`, "utf8");
process.on("SIGTERM", () => {});

if (depth < 2) {
  spawn(process.execPath, [fileURLToPath(import.meta.url), pidFile, String(depth + 1)], {
    detached: false,
    stdio: "ignore",
  });
}

setInterval(() => {}, 1_000);
