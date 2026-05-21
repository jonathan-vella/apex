#!/usr/bin/env node
// Crawl every doc page on the dev server and report any non-200 responses
// or broken in-page links. Intended for local QA only.
import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../site/src/content/docs");
const BASE = "http://localhost:4321/azure-agentic-infraops";

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function fileToUrl(file) {
  let rel = relative(ROOT, file)
    .replace(/\\/g, "/")
    .replace(/\.mdx?$/, "")
    .replace(/(^|\/)index$/, "$1");
  rel = rel.replace(/\/$/, "");
  return rel ? `/${rel}/` : "/";
}

const files = await walk(ROOT);
const urls = files.map(fileToUrl).sort();

const results = [];
const linkTargets = new Set();

for (const u of urls) {
  const url = `${BASE}${u}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const status = res.status;
    let html = "";
    if (status === 200) html = await res.text();
    results.push({ url: u, status });

    // Extract in-page <a href="..."> targets that point at the docs site.
    const linkRe = /href="([^"#]+)(#[^"]*)?"/g;
    let m;
    while ((m = linkRe.exec(html))) {
      const href = m[1];
      if (!href) continue;
      if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
      if (href.startsWith("/azure-agentic-infraops/")) {
        // Doc URLs get a trailing slash for Set dedupe; static assets
        // (anything with a file extension in the last segment) stay as-is.
        const lastSegment = href.split("/").pop() || "";
        const isAsset = lastSegment.includes(".");
        linkTargets.add(isAsset || href.endsWith("/") ? href : `${href}/`);
      }
    }
  } catch (e) {
    results.push({ url: u, status: "ERR", error: e.message });
  }
}

const bad = results.filter((r) => r.status !== 200);
console.log(`Pages crawled: ${results.length}`);
console.log(`Non-200 pages: ${bad.length}`);
for (const r of bad) console.log(`  [${r.status}] ${r.url}${r.error ? ` - ${r.error}` : ""}`);

console.log(`\nUnique internal link targets: ${linkTargets.size}`);
const linkResults = [];
for (const t of linkTargets) {
  try {
    const res = await fetch(`http://localhost:4321${t}`, { redirect: "manual" });
    linkResults.push({ url: t, status: res.status });
  } catch (e) {
    linkResults.push({ url: t, status: "ERR", error: e.message });
  }
}

// 2xx and 3xx are healthy (3xx covers our intentional redirects).
const badLinks = linkResults.filter((r) => {
  if (typeof r.status === "number") return r.status >= 400;
  return true;
});
console.log(`Broken links: ${badLinks.length}`);
for (const r of badLinks) console.log(`  [${r.status}] ${r.url}${r.error ? ` - ${r.error}` : ""}`);

if (bad.length || badLinks.length) process.exit(1);
