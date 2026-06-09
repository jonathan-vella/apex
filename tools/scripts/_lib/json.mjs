/**
 * Shared JSON helpers.
 *
 * Consolidates the strict reader, the pretty-printer writer, and the
 * SHA-256 file digest that were re-implemented inline across many
 * validators. Behavior is identical to the inline versions they replace:
 *
 *   - `readJson`     — `JSON.parse(fs.readFileSync(path, "utf8"))`; throws
 *                      on a missing file or invalid JSON.
 *   - `readJsonSafe` — returns `fallback` (default `null`) on any error.
 *   - `writeJson`    — 2-space-indented JSON with a trailing newline.
 *   - `sha256File`   — lowercase hex SHA-256 of the file's raw bytes.
 *
 * @example
 *   import { readJson, sha256File } from "./_lib/json.mjs";
 *   const cfg = readJson(path);
 *   const digest = sha256File(path);
 */

import fs from "node:fs";
import crypto from "node:crypto";

/** Strict JSON read. Throws on missing file or invalid JSON. */
export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Tolerant JSON read. Returns `fallback` (default `null`) on any error. */
export function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

/** Pretty-print JSON with 2-space indent and a trailing newline. */
export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/** Lowercase hex SHA-256 digest of the file's raw bytes. */
export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
