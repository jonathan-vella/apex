#!/usr/bin/env node
/**
 * lint-docs-frontmatter.mjs — enforce required frontmatter fields across the
 * Astro docs site. Currently checks:
 *   - `title:` is present
 *   - `description:` is present and non-empty
 *
 * Exits non-zero on the first failure category. Intended for `npm run lint:docs-frontmatter`.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCS_ROOT = path.join(REPO_ROOT, "site", "src", "content", "docs");

async function walk(dir, acc) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, acc);
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function parseFrontmatter(src) {
  if (!src.startsWith("---")) return null;
  const end = src.indexOf("\n---", 3);
  if (end < 0) return null;
  const block = src.slice(3, end);
  const out = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

async function main() {
  // Accelerator-derived repos exclude site/ from the upstream sync, so the
  // docs tree may not exist. Skip cleanly instead of throwing ENOENT.
  if (!existsSync(DOCS_ROOT)) {
    console.log(`✔ no docs site at ${path.relative(REPO_ROOT, DOCS_ROOT)} — frontmatter lint skipped.`);
    return;
  }
  const files = await walk(DOCS_ROOT, []);
  const issues = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    const fm = parseFrontmatter(src);
    const rel = path.relative(REPO_ROOT, file);
    if (!fm) {
      issues.push({ file: rel, reason: "missing frontmatter block" });
      continue;
    }
    if (!fm.title) issues.push({ file: rel, reason: "missing `title`" });
    if (!fm.description || fm.description === '""' || fm.description === "''") {
      issues.push({ file: rel, reason: "missing or empty `description`" });
    }
  }
  if (issues.length) {
    console.error(`✖ ${issues.length} frontmatter issue(s):`);
    for (const i of issues) console.error(`  - ${i.file} — ${i.reason}`);
    process.exit(1);
  }
  console.log(`✔ ${files.length} docs pages have valid frontmatter.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
