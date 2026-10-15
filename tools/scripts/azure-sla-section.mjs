#!/usr/bin/env node
// Print one service's section from the official Microsoft Online Services SLA document.
//
// Why: the azure.microsoft.com/support/legal/sla/* pages redirect to a licensing index, so
// fetching them replays a very large, repeated page into the chat. The authoritative SLA
// is a downloadable .docx; this script downloads it once, caches it, and prints only the
// requested service section (bounded) so agents can cite figures without the full text.
//
// Usage:
//   node tools/scripts/azure-sla-section.mjs "<service>" [--max-lines N] [--month YYYY-MM]
//   node tools/scripts/azure-sla-section.mjs --list [filter]
//   node tools/scripts/azure-sla-section.mjs "<service>" --file <local.docx>
//
// Examples:
//   node tools/scripts/azure-sla-section.mjs "App Service"
//   node tools/scripts/azure-sla-section.mjs "Azure SQL Database" --max-lines 120
//   node tools/scripts/azure-sla-section.mjs --list storage
//
// Exit codes: 0 section printed or list shown; 1 service not found; 2 usage, download or parse error.
// Requires the `unzip` binary (present in the dev container).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DEFAULT_MAX_LINES = 80;
const LINE_WIDTH = 300;
const LOOKBACK_MONTHS = 4;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const END_MARKER = "table of contents / definitions";

export function slaDocUrl(year, monthIndex) {
  return `https://www.microsoft.com/licensing/docs/documents/download/OnlineSvcsConsolidatedSLA(WW)(English)(${MONTHS[monthIndex]}_${year})(CR).docx`;
}

// The SLA is republished monthly; the newest edition may not exist yet, so walk backwards.
export function candidateMonths(now = new Date(), count = LOOKBACK_MONTHS) {
  const out = [];
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  for (let i = 0; i < count; i++) {
    out.push({ year, month });
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return out;
}

export function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// A tag without its closing ">" survives a plain tag regex ("<script"), so the closing bracket is optional and the pass repeats to a fixed point.
export function stripTags(text) {
  let current = text;
  let previous;
  do {
    previous = current;
    current = current.replace(/<[^>]*>?/g, "");
  } while (current !== previous);
  return current;
}

export function docxXmlToParagraphs(xml) {
  const paragraphs = xml.match(/<w:p[ >].*?<\/w:p>/gs) ?? [];
  return paragraphs.map((p) => decodeEntities(stripTags(p)).trim()).filter((t) => t.length > 0);
}

export function tocServices(paragraphs) {
  const names = new Set();
  for (const line of paragraphs) {
    if (!/\bPAGEREF\b/.test(line)) continue;
    const name = line.replace(/\s*PAGEREF.*$/, "").trim();
    if (name) names.add(name);
  }
  return [...names];
}

export function extractSections(paragraphs, service, maxLines = DEFAULT_MAX_LINES) {
  const wanted = service.trim().toLowerCase();
  const tocNames = new Set(tocServices(paragraphs).map((n) => n.toLowerCase()));
  const sections = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const line = paragraphs[i];
    if (/\bPAGEREF\b/.test(line) || line.toLowerCase() !== wanted) continue;
    let end = i + 1;
    while (end < paragraphs.length) {
      const next = paragraphs[end].toLowerCase();
      if (next === END_MARKER || (tocNames.has(next) && !/\bPAGEREF\b/.test(paragraphs[end]))) break;
      end++;
    }
    const total = end - i;
    sections.push({
      startLine: i + 1,
      totalLines: total,
      truncated: total > maxLines,
      lines: paragraphs.slice(i, Math.min(end, i + maxLines)),
    });
  }
  return sections;
}

export function parseArgs(argv) {
  const args = { service: null, list: false, filter: null, maxLines: DEFAULT_MAX_LINES, file: null, month: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--max-lines") args.maxLines = Number.parseInt(argv[++i], 10);
    else if (a === "--file") args.file = argv[++i];
    else if (a === "--month") args.month = argv[++i];
    else if (a.startsWith("--")) return { error: `unknown option ${a}` };
    else positional.push(a);
  }
  if (!Number.isInteger(args.maxLines) || args.maxLines < 1) return { error: "--max-lines needs a positive integer" };
  if (args.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(args.month)) return { error: "--month needs YYYY-MM" };
  if (args.list) args.filter = positional[0] ?? null;
  else if (positional.length === 1) args.service = positional[0];
  else return { error: "provide exactly one service name, or use --list [filter]" };
  return args;
}

async function downloadDocx(cacheDir, args, fetchImpl, now) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const months = args.month
    ? [{ year: Number(args.month.slice(0, 4)), month: Number(args.month.slice(5)) - 1 }]
    : candidateMonths(now);
  for (const { year, month } of months) {
    const cached = path.join(cacheDir, `sla-${year}-${String(month + 1).padStart(2, "0")}.docx`);
    const url = slaDocUrl(year, month);
    if (fs.existsSync(cached) && fs.statSync(cached).size > 0) {
      return { file: cached, url, label: `${MONTHS[month]} ${year}`, cached: true };
    }
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!res.ok) continue;
      const body = Buffer.from(await res.arrayBuffer());
      // A docx is a zip; anything else is an HTML error page for a month not yet published.
      if (body.subarray(0, 2).toString("latin1") !== "PK") continue;
      fs.writeFileSync(cached, body);
      return { file: cached, url, label: `${MONTHS[month]} ${year}`, cached: false };
    } catch {
      continue;
    }
  }
  return null;
}

function readParagraphs(docxPath) {
  const xml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return docxXmlToParagraphs(xml);
}

export async function run(
  argv,
  {
    out = console.log,
    err = console.error,
    fetchImpl = fetch,
    now = new Date(),
    cacheDir = path.join(os.tmpdir(), "apex-sla"),
  } = {},
) {
  const args = parseArgs(argv);
  if (args.error) {
    err(`error: ${args.error}`);
    err('usage: azure-sla-section.mjs "<service>" [--max-lines N] [--month YYYY-MM] | --list [filter] | --file <docx>');
    return 2;
  }

  let source;
  if (args.file) {
    if (!fs.existsSync(args.file)) {
      err(`error: file not found: ${args.file}`);
      return 2;
    }
    source = { file: args.file, url: "(local file)", label: path.basename(args.file), cached: true };
  } else {
    source = await downloadDocx(cacheDir, args, fetchImpl, now);
    if (!source) {
      err("error: could not download the SLA document for the recent months; pass --file <docx> or --month YYYY-MM");
      return 2;
    }
  }

  let paragraphs;
  try {
    paragraphs = readParagraphs(source.file);
  } catch (e) {
    err(`error: could not read ${source.file}: ${e.message}`);
    return 2;
  }

  out(`Source: ${source.url}`);
  out(`Document: ${source.label} (${source.cached ? "cached" : "downloaded"} at ${source.file})`);

  if (args.list) {
    const filter = args.filter?.toLowerCase();
    const names = tocServices(paragraphs).filter((n) => !filter || n.toLowerCase().includes(filter));
    out(`Services${filter ? ` matching "${args.filter}"` : ""}: ${names.length}`);
    for (const n of names) out(`- ${n}`);
    return 0;
  }

  const sections = extractSections(paragraphs, args.service, args.maxLines);
  if (sections.length === 0) {
    const needle = args.service.toLowerCase();
    const close = tocServices(paragraphs)
      .filter((n) => n.toLowerCase().includes(needle))
      .slice(0, 10);
    err(
      `error: no section named "${args.service}".${close.length ? ` Close matches: ${close.join("; ")}` : " Use --list to browse."}`,
    );
    return 1;
  }

  for (const s of sections) {
    out(
      `--- "${args.service}" section at paragraph ${s.startLine} (${s.totalLines} paragraphs${s.truncated ? `, truncated at ${args.maxLines}; raise --max-lines` : ""}) ---`,
    );
    for (const line of s.lines) out(line.length > LINE_WIDTH ? `${line.slice(0, LINE_WIDTH)}...` : line);
  }
  return 0;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(await run(process.argv.slice(2)));
