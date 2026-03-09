/**
 * Docs Sync Validator
 *
 * Compares content hashes of docs/ versions against root versions
 * for files that should stay in sync. Fails if they diverge.
 *
 * Checked pairs:
 *   - docs/CONTRIBUTING.md ↔ CONTRIBUTING.md
 *   - docs/CHANGELOG.md    ↔ CHANGELOG.md
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SYNC_PAIRS = [
  { docs: "docs/CONTRIBUTING.md", root: "CONTRIBUTING.md" },
  { docs: "docs/CHANGELOG.md", root: "CHANGELOG.md" },
];

let hasError = false;

function hashFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return null;
  const content = fs.readFileSync(absPath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

for (const pair of SYNC_PAIRS) {
  const docsHash = hashFile(pair.docs);
  const rootHash = hashFile(pair.root);

  if (!docsHash) {
    console.log(`⚠️  ${pair.docs} not found — skipping`);
    continue;
  }
  if (!rootHash) {
    console.log(`⚠️  ${pair.root} not found — skipping`);
    continue;
  }

  if (docsHash !== rootHash) {
    console.error(
      `❌ ${pair.docs} and ${pair.root} have diverged. Sync them before committing.`,
    );
    hasError = true;
  } else {
    console.log(`✅ ${pair.docs} ↔ ${pair.root} — in sync`);
  }
}

if (hasError) {
  console.error(
    "\n🛑 Docs sync check failed. Copy the updated file to keep both in sync.",
  );
  process.exit(1);
} else {
  console.log("\n✅ All docs sync checks passed.");
}
