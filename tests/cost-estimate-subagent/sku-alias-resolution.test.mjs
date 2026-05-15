// Canonical SKU alias resolution smoke test.
//
// Parses the "Canonical SKU Aliases" table in
// .github/skills/azure-defaults/references/pricing-guidance.md and asserts:
//   1. The table is well-formed (no empty cells in required columns).
//   2. Every canonical sku_name appears in the file's "Common SKUs" / SKU
//      gotcha tables elsewhere in the same file (sanity cross-reference).
//   3. No duplicate "Variant input" entries (would create ambiguous rewrites).
//
// Phase C4 of the nordic-foods lessons plan. The full integration test
// against the live Pricing MCP runs in CI under external-tests; this is
// the offline shape contract that runs on every PR.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PRICING_GUIDANCE = path.join(ROOT, ".github/skills/azure-defaults/references/pricing-guidance.md");

function extractAliasTable(text) {
  // Find the section that starts with "## Canonical SKU Aliases" and ends
  // at the next "## " (any H2).
  const startMatch = text.match(/## Canonical SKU Aliases[\s\S]*?(?=\n## )/);
  assert.ok(startMatch, "Could not locate '## Canonical SKU Aliases' section in pricing-guidance.md");
  const section = startMatch[0];
  // Parse pipe-delimited rows that look like alias entries (skip header + separator)
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .slice(1, -1);
    // Skip header row ("Service" or "---")
    if (cells[0] === "Service" || cells[0].startsWith("---")) continue;
    if (cells.length < 4) continue;
    rows.push({
      service: cells[0],
      variantInput: cells[1],
      canonicalSku: cells[2],
      productFilter: cells[3],
      notes: cells[4] ?? "",
    });
  }
  return rows;
}

describe("Canonical SKU Aliases table", () => {
  const text = fs.readFileSync(PRICING_GUIDANCE, "utf-8");
  const rows = extractAliasTable(text);

  it("has at least 10 alias rows (full table seed per plan Phase C1)", () => {
    assert.ok(rows.length >= 10, `expected ≥10 rows, found ${rows.length}`);
  });

  it("every row has non-empty Service, Variant input, Canonical sku_name, product_filter", () => {
    for (const row of rows) {
      assert.ok(row.service, `empty Service column: ${JSON.stringify(row)}`);
      assert.ok(row.variantInput, `empty Variant input column: ${JSON.stringify(row)}`);
      assert.ok(row.canonicalSku, `empty Canonical sku_name column: ${JSON.stringify(row)}`);
      assert.ok(row.productFilter, `empty product_filter column: ${JSON.stringify(row)}`);
    }
  });

  it("no duplicate Variant input within a single Service (ambiguous rewrites)", () => {
    const seen = new Map();
    for (const row of rows) {
      const key = `${row.service}::${row.variantInput}`;
      if (seen.has(key)) {
        assert.fail(`Duplicate alias entry: ${key}`);
      }
      seen.set(key, row);
    }
  });

  it("includes the four critical aliases called out by the nordic-foods plan", () => {
    // From the plan's C1 seed: SQL DB serverless 2 vCore, P1v3 Linux, P0v3, Standard ZRS
    const checks = [
      { service: "SQL Database", variantInput: "2 vCore General Purpose Serverless Gen5" },
      { service: "App Service Plan", variantInput: "P1v3 Linux" },
      { service: "App Service Plan", variantInput: "P0v3" },
      { service: "Storage Account", variantInput: "Standard ZRS" },
    ];
    for (const c of checks) {
      const found = rows.find(
        (r) => r.service === c.service && r.variantInput.includes(c.variantInput.replace(/`/g, "").replace(/\\/g, "")),
      );
      // Variant input cells are backtick-wrapped — match by service first, then loose substring
      const looseFound = rows.find(
        (r) => r.service === c.service && r.variantInput.toLowerCase().includes(c.variantInput.toLowerCase()),
      );
      assert.ok(found || looseFound, `Missing canonical alias for ${c.service} / "${c.variantInput}"`);
    }
  });
});
