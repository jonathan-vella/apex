#!/usr/bin/env node
// Lightweight CLI: verify that an artifact's H2 headings match the
// canonical sequence from tools/scripts/_lib/artifact-headings.mjs.
//
// Purpose: replace fragile inline `node -e '…'` H2 checks (and the
// shell-quoting traps they cause) with one stable file invocation.
//
// Usage:
//   node tools/scripts/check-h2-order.mjs <project> [artifact-filename]
//   node tools/scripts/check-h2-order.mjs <full/path/to/artifact.md>
//
// Examples:
//   node tools/scripts/check-h2-order.mjs test03
//     # defaults to 01-requirements.md
//   node tools/scripts/check-h2-order.mjs test03 04-implementation-plan.md
//   node tools/scripts/check-h2-order.mjs agent-output/test03/01-requirements.md
//
// Semantics:
//   - The artifact's H2 headings (in document order) must START WITH the
//     full required sequence for that artifact type.
//   - Extra trailing H2 headings (e.g. `## References`) are allowed.
//     This mirrors `tools/scripts/validate-artifacts.mjs` behaviour.
//   - Mismatch: print {expected, got, missingAt} JSON and exit 1.
//   - Match: print "OK: <artifact> H2 order matches template (<N> required, <M> total)" and exit 0.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACT_HEADINGS } from "./_lib/artifact-headings.mjs";
import { extractH2Headings } from "./_lib/h2-parser.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");

function usage(msg) {
  if (msg) console.error(`error: ${msg}`);
  console.error(
    "usage: node tools/scripts/check-h2-order.mjs <project> [artifact-filename]\n" +
      "       node tools/scripts/check-h2-order.mjs <path-to-artifact.md>",
  );
  process.exit(2);
}

function resolveArtifact(arg1, arg2) {
  if (!arg1) usage("missing argument");

  // Form 2: explicit path
  if (arg1.includes("/") || arg1.endsWith(".md")) {
    const filePath = path.isAbsolute(arg1) ? arg1 : path.join(REPO_ROOT, arg1);
    const filename = path.basename(filePath);
    return { filePath, filename };
  }

  // Form 1: project [artifact-filename]
  const project = arg1;
  const filename = arg2 || "01-requirements.md";
  const filePath = path.join(REPO_ROOT, "agent-output", project, filename);
  return { filePath, filename };
}

function main() {
  const [, , arg1, arg2] = process.argv;
  const { filePath, filename } = resolveArtifact(arg1, arg2);

  const expected = ARTIFACT_HEADINGS[filename];
  if (!expected) {
    console.error(
      `error: no canonical H2 registry entry for "${filename}". Known artifacts: ${Object.keys(ARTIFACT_HEADINGS)
        .sort()
        .join(", ")}`,
    );
    process.exit(2);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`error: artifact not found at ${filePath}`);
    process.exit(2);
  }

  const text = fs.readFileSync(filePath, "utf8");
  const got = extractH2Headings(text).map((h) => `## ${h}`);

  // Required prefix match. Anything trailing is permitted.
  for (let i = 0; i < expected.length; i++) {
    if (got[i] !== expected[i]) {
      console.error(
        JSON.stringify(
          {
            status: "MISMATCH",
            artifact: path.relative(REPO_ROOT, filePath),
            missingAt: i,
            expected: expected[i] ?? null,
            got: got[i] ?? null,
            fullExpected: expected,
            fullGot: got,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
  }

  console.log(
    `OK: ${path.relative(REPO_ROOT, filePath)} H2 order matches template (${expected.length} required, ${got.length} total)`,
  );
}

main();
