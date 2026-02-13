#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const result = spawnSync("node", ["scripts/validate-artifact-templates.mjs"], {
  stdio: "inherit",
});

if (result.error) {
  console.error(
    "Failed to run unified artifact validator:",
    result.error.message,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
