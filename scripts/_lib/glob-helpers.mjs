/**
 * Glob Helpers
 *
 * Shared file-walking patterns with consistent exclude rules.
 * Eliminates duplicated EXCLUDE_DIRS / SKIP_PATTERNS across validators.
 *
 * @example
 *   import { walkFiles } from "./_lib/glob-helpers.mjs";
 *   const bicepFiles = walkFiles("infra/bicep", ".bicep");
 *   const mdFiles = walkFiles(".github/skills", ".md");
 */

import fs from "node:fs";
import path from "node:path";

/** Directories always excluded from validation walks */
const ALWAYS_EXCLUDE = new Set([
  "node_modules",
  ".git",
  ".venv",
  "venv",
  "dist",
  "build",
  "__pycache__",
  ".pytest_cache",
  ".terraform",
]);

/**
 * Walk a directory recursively and return files matching an extension.
 * Applies consistent exclude rules across all validators.
 *
 * @param {string} dir - Root directory to walk (relative to cwd)
 * @param {string|string[]} extensions - File extension(s) including dot, e.g. ".mjs" or [".bicep", ".tf"]
 * @param {object} [options] - Options
 * @param {Set<string>} [options.excludeDirs] - Additional directory names to skip
 * @returns {string[]} Relative file paths from cwd
 */
export function walkFiles(dir, extensions, options = {}) {
  const root = path.resolve(dir);
  if (!fs.existsSync(root)) return [];

  const exts = Array.isArray(extensions) ? extensions : [extensions];
  const excludeDirs = options.excludeDirs
    ? new Set([...ALWAYS_EXCLUDE, ...options.excludeDirs])
    : ALWAYS_EXCLUDE;

  const results = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        if (exts.some((ext) => entry.name.endsWith(ext))) {
          results.push(
            path.relative(process.cwd(), path.join(currentDir, entry.name)),
          );
        }
      }
    }
  }

  walk(root);
  return results;
}
