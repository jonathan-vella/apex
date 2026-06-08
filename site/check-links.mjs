#!/usr/bin/env node
/**
 * Checks all internal links in the built Astro site (dist/).
 * Validates that every href resolves to an existing file/page.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve dist/ relative to this script so the check works whether invoked
// from site/ (`node check-links.mjs`) or from the repo root
// (`node site/check-links.mjs`).
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(SCRIPT_DIR, "dist");
const BASE = "/apex";

// Collect all HTML files
function walkHtml(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkHtml(full));
    } else if (entry.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

// Strip every `<tag>…</tag>` block from `input` using non-regex string
// scanning. This avoids the well-known CodeQL traps around incomplete
// multi-character HTML sanitizers (js/incomplete-multi-character-sanitization,
// js/bad-tag-filter): there is no regex to mis-handle whitespace/newlines
// inside an end tag, no unanchored fallback that can leave `<tag` substrings
// behind, and the scan is provably complete.
function stripBlocks(input, tagName) {
  const open = `<${tagName}`;
  const close = `</${tagName}`;
  const lower = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < input.length) {
    const start = lower.indexOf(open, i);
    if (start === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, start);
    const endTag = lower.indexOf(close, start + open.length);
    if (endTag === -1) {
      // No closing tag — strip the rest of the input to guarantee no
      // `<tag` substring survives.
      break;
    }
    const gt = input.indexOf(">", endTag + close.length);
    if (gt === -1) break;
    i = gt + 1;
  }
  return out;
}

// Extract href values from HTML
// Strip <script>…</script> and <style>…</style> blocks first — their bodies
// contain JavaScript/CSS source that often includes literal href="…" patterns
// (e.g., template literals inside Astro define:vars scripts) which are not
// real rendered links. Matching them produces false-positive broken links.
function extractHrefs(html) {
  const cleaned = stripBlocks(stripBlocks(html, "script"), "style");
  const re = /href="([^"]+)"/g;
  const hrefs = [];
  let m;
  while ((m = re.exec(cleaned))) hrefs.push(m[1]);
  return hrefs;
}

// Resolve a link to a file path in dist
function resolveLink(href, pageDir) {
  // Skip external, mailto, tel, javascript, anchor-only
  if (/^(https?:|mailto:|tel:|javascript:|#)/.test(href)) return null;

  let resolved;
  if (href.startsWith("/")) {
    // Absolute path — strip base prefix
    let path = href;
    if (path.startsWith(BASE)) {
      path = path.slice(BASE.length);
    }
    resolved = join(DIST, path);
  } else {
    // Relative path — resolve from the rendered page directory.
    resolved = resolve(pageDir, href);
  }

  // Strip hash
  resolved = resolved.replace(/#.*$/, "");
  // Strip query
  resolved = resolved.replace(/\?.*$/, "");

  return resolved;
}

function checkFile(filePath) {
  // Direct file exists
  if (existsSync(filePath) && statSync(filePath).isFile()) return true;
  // Directory with index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return existsSync(join(filePath, "index.html"));
  }
  // Try adding index.html
  if (existsSync(join(filePath, "index.html"))) return true;
  // Try .html extension
  if (existsSync(filePath + ".html")) return true;
  return false;
}

const htmlFiles = walkHtml(DIST);
let broken = 0;
let total = 0;
const brokenLinks = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf-8");
  const hrefs = extractHrefs(html);
  // Page URL is the directory path of this HTML file
  const relPath = file.slice(DIST.length); // e.g. /getting-started/quickstart/index.html
  const pageDir = dirname(file); // directory containing index.html

  for (const href of hrefs) {
    const target = resolveLink(href, pageDir);
    if (!target) continue;
    total++;

    if (!checkFile(target)) {
      broken++;
      const pageSlug = relPath.replace(/\/index\.html$/, "/");
      brokenLinks.push({
        page: pageSlug,
        href,
        resolvedTo: target.slice(DIST.length),
      });
    }
  }
}

if (brokenLinks.length === 0) {
  console.log(`✓ All ${total} internal links are valid.`);
  process.exit(0);
} else {
  console.log(`✗ Found ${broken} broken links out of ${total} total:\n`);
  // Group by page
  const byPage = {};
  for (const { page, href, resolvedTo } of brokenLinks) {
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push({ href, resolvedTo });
  }
  for (const [page, links] of Object.entries(byPage)) {
    console.log(`  ${page}`);
    for (const { href, resolvedTo } of links) {
      console.log(`    → ${href}`);
      console.log(`      (resolves to: ${resolvedTo})`);
    }
    console.log();
  }
  process.exit(1);
}
