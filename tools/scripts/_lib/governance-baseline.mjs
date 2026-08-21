/** Read governance baselines stored as JSON or gzip-compressed JSON. */

import fs from "node:fs";
import { gunzipSync } from "node:zlib";

const cache = new Map();

export function readGovernanceBaseline(filePath) {
  if (!cache.has(filePath)) {
    let raw = fs.readFileSync(filePath);
    if (filePath.endsWith(".gz") || (raw[0] === 0x1f && raw[1] === 0x8b)) {
      raw = gunzipSync(raw);
    }
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("governance baseline root must be an object");
    }
    cache.set(filePath, parsed);
  }
  return cache.get(filePath);
}

export function resetGovernanceBaselineCache(filePath) {
  if (filePath) cache.delete(filePath);
  else cache.clear();
}
