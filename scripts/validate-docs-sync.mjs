/**
 * Docs Sync Validator
 *
 * Compares content hashes of docs/ versions against root versions
 * for files that should stay in sync. Fails if they diverge.
 *
 * Checked pairs:
 *   - docs/CONTRIBUTING.md <-> CONTRIBUTING.md
 *   - docs/CHANGELOG.md    <-> CHANGELOG.md
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = process.cwd();

const SYNC_PAIRS = [
  { docs: "docs/CONTRIBUTING.md", root: "CONTRIBUTING.md" },
  { docs: "docs/CHANGELOG.md", root: "CHANGELOG.md" },
];

const r = new Reporter("Docs Sync Validator");
r.header();

function hashFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return null;
  const content = fs.readFileSync(absPath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

for (const pair of SYNC_PAIRS) {
  r.tick();
  const docsHash = hashFile(pair.docs);
  const rootHash = hashFile(pair.root);

  if (!docsHash) {
    r.warn(`${pair.docs} not found — skipping`);
    continue;
  }
  if (!rootHash) {
    r.warn(`${pair.root} not found — skipping`);
    continue;
  }

  if (docsHash !== rootHash) {
    r.error(
      `${pair.docs} and ${pair.root} have diverged. Sync them before committing.`,
    );
  } else {
    r.ok(`${pair.docs} ↔ ${pair.root} — in sync`);
  }
}

r.summary();
r.exitOnError("Docs sync check passed", "Docs sync check failed");
