import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import test from "node:test";

import { readGovernanceBaseline, resetGovernanceBaselineCache } from "../../scripts/_lib/governance-baseline.mjs";

test("loads plain and compressed governance JSON with caching", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-governance-"));
  const plain = path.join(dir, "baseline.json");
  const compressed = `${plain}.gz`;
  const baseline = { schema_version: "governance-baseline-v1", subscriptions: {} };
  const raw = Buffer.from(JSON.stringify(baseline));
  fs.writeFileSync(plain, raw);
  fs.writeFileSync(compressed, gzipSync(raw, { mtime: 0 }));

  assert.deepEqual(readGovernanceBaseline(plain), baseline);
  const first = readGovernanceBaseline(compressed);
  assert.deepEqual(first, baseline);
  assert.strictEqual(readGovernanceBaseline(compressed), first);
  resetGovernanceBaselineCache(compressed);
  assert.notStrictEqual(readGovernanceBaseline(compressed), first);
});
