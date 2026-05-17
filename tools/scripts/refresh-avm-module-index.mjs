#!/usr/bin/env node
/**
 * AVM Module Index Refresh
 *
 * Fetches the canonical Azure Verified Modules indexes published by the AVM
 * team and pre-warms the per-module version cache that backs
 * `validate:avm-versions:freeze`.
 *
 * Inputs (upstream, network):
 *   - https://azure.github.io/Azure-Verified-Modules/module-indexes/BicepResourceModules.csv
 *   - https://azure.github.io/Azure-Verified-Modules/module-indexes/TerraformResourceModules.csv
 *
 * Outputs (checked-in artifacts):
 *   - .github/data/avm-bicep-modules.csv          (verbatim upstream copy)
 *   - .github/data/avm-terraform-modules.csv      (verbatim upstream copy)
 *   - .github/data/avm-module-index.json          (derived, agent-friendly)
 *   - tools/scripts/_data/avm-module-cache.json   (per-module latest version)
 *
 * Schema (avm-module-index-v1):
 *   {
 *     schema_version: "avm-module-index-v1",
 *     generated_at: "<ISO-8601>",
 *     sources: { bicep: "<url>", terraform: "<url>" },
 *     module_counts: { bicep: N, terraform: M },
 *     modules: [
 *       {
 *         tool: "bicep" | "terraform",
 *         module_name: "avm/res/key-vault/vault" | "avm-res-keyvault-vault",
 *         source: "br/public:avm/res/key-vault/vault" | "Azure/avm-res-keyvault-vault/azurerm",
 *         provider_namespace: "Microsoft.KeyVault",
 *         resource_type: "vaults",
 *         module_status: "Available" | "Proposed" | "Orphaned" | ...,
 *         display_name: "Key Vault",
 *         repo_url: "https://github.com/...",
 *         alternative_names: "KV, KeyVault"
 *       },
 *       ...
 *     ]
 *   }
 *
 * Why CSV-derived: the upstream CSV is the AVM team's source of truth for
 * which modules exist and their lifecycle status. It does NOT carry the
 * semver — `PublicRegistryReference` is `…X.Y.Z` (Bicep) / `…/latest` (TF).
 * Versions are resolved by calling MCR / registry.terraform.io for each
 * Available module via the existing resolver in `_lib/avm-module-resolver.mjs`,
 * which writes them to `tools/scripts/_data/avm-module-cache.json`.
 *
 * Usage:
 *   node tools/scripts/refresh-avm-module-index.mjs
 *   node tools/scripts/refresh-avm-module-index.mjs --no-version-refresh
 *   node tools/scripts/refresh-avm-module-index.mjs --concurrency=12
 *
 * Flags:
 *   --no-version-refresh   Skip per-module MCR/registry calls. Index-only refresh.
 *   --concurrency=N        Parallel module lookups (default 8, max 16).
 *   --timeout-ms=N         Per-fetch timeout (default 15000).
 *   --statuses=a,b,c       Only resolve versions for these statuses (default: Available).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLatest } from "./_lib/avm-module-resolver.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(ROOT, ".github/data");

const SOURCES = {
  bicep: "https://azure.github.io/Azure-Verified-Modules/module-indexes/BicepResourceModules.csv",
  terraform: "https://azure.github.io/Azure-Verified-Modules/module-indexes/TerraformResourceModules.csv",
};

const RAW_CSV_PATHS = {
  bicep: path.join(DATA_DIR, "avm-bicep-modules.csv"),
  terraform: path.join(DATA_DIR, "avm-terraform-modules.csv"),
};
const INDEX_JSON_PATH = path.join(DATA_DIR, "avm-module-index.json");

const DEFAULT_OPTS = {
  versionRefresh: true,
  concurrency: 8,
  timeoutMs: 15_000,
  statuses: ["available"], // lowercased; refresh versions for these only
};

function parseArgs(argv) {
  const opts = { ...DEFAULT_OPTS };
  for (const arg of argv) {
    if (arg === "--no-version-refresh") opts.versionRefresh = false;
    else if (arg.startsWith("--concurrency=")) {
      const n = Number(arg.slice("--concurrency=".length));
      if (!Number.isFinite(n) || n < 1) throw new Error(`Invalid --concurrency=${arg}`);
      opts.concurrency = Math.min(16, Math.max(1, Math.trunc(n)));
    } else if (arg.startsWith("--timeout-ms=")) {
      const n = Number(arg.slice("--timeout-ms=".length));
      if (!Number.isFinite(n) || n < 1000) throw new Error(`Invalid --timeout-ms=${arg}`);
      opts.timeoutMs = Math.trunc(n);
    } else if (arg.startsWith("--statuses=")) {
      opts.statuses = arg
        .slice("--statuses=".length)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage: refresh-avm-module-index.mjs [options]",
      "",
      "Options:",
      "  --no-version-refresh   Skip per-module MCR/registry calls (CSV refresh only).",
      "  --concurrency=N        Parallel module lookups (default 8, max 16).",
      "  --timeout-ms=N         Per-fetch timeout (default 15000).",
      "  --statuses=a,b,c       Only resolve versions for these statuses (default: available).",
      "",
    ].join("\n"),
  );
}

async function fetchCsv(url, { timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Minimal CSV parser. Handles quoted fields with embedded commas and
 * RFC-4180-style escaped quotes ("" inside a quoted field). The AVM CSV
 * does not embed newlines inside fields, so we tokenise line-by-line.
 */
function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = cells[i] ?? "";
    }
    return row;
  });
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"' && cur.length === 0) {
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Map a parsed CSV row to the agent-friendly index entry.
 * Bicep `ModuleName` looks like `avm/res/key-vault/vault`.
 * Terraform `ModuleName` looks like `avm-res-keyvault-vault`.
 */
function toIndexEntry(tool, row) {
  const moduleName = (row.ModuleName ?? "").trim();
  if (!moduleName || moduleName.toLowerCase() === "n/a") return null;
  const source = tool === "bicep" ? `br/public:${moduleName}` : `Azure/${moduleName}/azurerm`;
  return {
    tool,
    module_name: moduleName,
    source,
    provider_namespace: (row.ProviderNamespace ?? "").trim(),
    resource_type: (row.ResourceType ?? "").trim(),
    module_status: (row.ModuleStatus ?? "").trim(),
    display_name: (row.ModuleDisplayName ?? "").trim(),
    repo_url: (row.RepoURL ?? "").trim(),
    alternative_names: (row.AlternativeNames ?? "").trim(),
  };
}

async function refreshVersionsFor(modules, { concurrency, statuses }) {
  const eligible = modules.filter((m) => statuses.includes(m.module_status.toLowerCase()));
  const total = eligible.length;
  let done = 0;
  let ok = 0;
  let missing = 0;
  let unreachable = 0;

  // Bounded-concurrency worker pool. We deliberately do not import a
  // dependency for this — keeps the script standalone.
  const queue = eligible.slice();
  async function worker(workerId) {
    while (queue.length > 0) {
      const mod = queue.shift();
      if (!mod) return;
      try {
        const r = await resolveLatest({ tool: mod.tool, source: mod.source, mode: "ci" });
        if (r.status === "ok") ok++;
        else if (r.status === "missing") missing++;
        else unreachable++;
      } catch (err) {
        unreachable++;
        process.stderr.write(`[worker ${workerId}] ${mod.source}: ${err.message ?? err}\n`);
      }
      done++;
      if (done % 25 === 0 || done === total) {
        process.stdout.write(
          `  resolved ${done}/${total} (ok=${ok}, missing=${missing}, unreachable=${unreachable})\n`,
        );
      }
    }
  }
  const workerCount = Math.min(concurrency, Math.max(1, eligible.length));
  await Promise.all(Array.from({ length: workerCount }, (_, i) => worker(i + 1)));
  return { total, ok, missing, unreachable };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfChanged(filePath, content) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
  if (previous === content) return false;
  fs.writeFileSync(filePath, content);
  return true;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.stdout.write("\n🔄 AVM Module Index Refresh\n\n");
  ensureDir(DATA_DIR);

  // 1. Fetch CSVs.
  const csvs = {};
  for (const [tool, url] of Object.entries(SOURCES)) {
    process.stdout.write(`  Fetching ${tool} index ... `);
    csvs[tool] = await fetchCsv(url, { timeoutMs: opts.timeoutMs });
    process.stdout.write(`${csvs[tool].length.toLocaleString()} bytes\n`);
  }

  // 2. Save verbatim CSVs.
  let csvChanged = false;
  for (const tool of Object.keys(SOURCES)) {
    if (writeIfChanged(RAW_CSV_PATHS[tool], csvs[tool])) {
      csvChanged = true;
      process.stdout.write(`  ✓ Updated ${path.relative(ROOT, RAW_CSV_PATHS[tool])}\n`);
    } else {
      process.stdout.write(`  · No change to ${path.relative(ROOT, RAW_CSV_PATHS[tool])}\n`);
    }
  }

  // 3. Parse + derive structured index.
  const allModules = [];
  const counts = { bicep: 0, terraform: 0 };
  for (const tool of ["bicep", "terraform"]) {
    const { rows } = parseCsv(csvs[tool]);
    for (const row of rows) {
      const entry = toIndexEntry(tool, row);
      if (entry) {
        allModules.push(entry);
        counts[tool]++;
      }
    }
  }
  allModules.sort((a, b) => {
    if (a.tool !== b.tool) return a.tool.localeCompare(b.tool);
    return a.module_name.localeCompare(b.module_name);
  });

  const index = {
    $schema: null,
    schema_version: "avm-module-index-v1",
    generated_at: new Date().toISOString(),
    sources: SOURCES,
    module_counts: counts,
    notes:
      "Generated by tools/scripts/refresh-avm-module-index.mjs. " +
      "Source of truth for which AVM modules exist + their lifecycle status. " +
      "Versions are resolved separately and live in tools/scripts/_data/avm-module-cache.json.",
    modules: allModules,
  };
  const indexJson = `${JSON.stringify(index, null, 2)}\n`;
  if (writeIfChanged(INDEX_JSON_PATH, indexJson)) {
    process.stdout.write(`  ✓ Updated ${path.relative(ROOT, INDEX_JSON_PATH)} (${allModules.length} modules)\n`);
  } else {
    process.stdout.write(`  · No change to ${path.relative(ROOT, INDEX_JSON_PATH)}\n`);
  }

  // 4. Per-module version refresh (optional).
  if (opts.versionRefresh) {
    process.stdout.write(
      `\n  Refreshing versions (statuses=${opts.statuses.join("|")}, concurrency=${opts.concurrency}) ...\n`,
    );
    const stats = await refreshVersionsFor(allModules, opts);
    process.stdout.write(
      `\n  Version refresh: ok=${stats.ok}, missing=${stats.missing}, unreachable=${stats.unreachable} (total eligible=${stats.total})\n`,
    );
  } else {
    process.stdout.write("\n  Version refresh: skipped (--no-version-refresh)\n");
  }

  // 5. Summary footer.
  process.stdout.write("\n──────────────────────────────────────────────────\n");
  process.stdout.write(
    `Bicep modules: ${counts.bicep} | Terraform modules: ${counts.terraform} | CSV changed: ${csvChanged ? "yes" : "no"}\n`,
  );
  process.stdout.write("\n✅ AVM module index refresh complete\n");
}

main().catch((err) => {
  process.stderr.write(`\n❌ ${err.stack ?? err.message ?? err}\n`);
  process.exit(1);
});
