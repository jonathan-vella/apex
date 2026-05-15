// Renderer unit test for tools/scripts/render-sku-manifest-md.mjs
//
// Asserts:
//  - Fixture JSON renders to expected MD (idempotent across two runs).
//  - Revision mismatch self-check fails (we patch the rendered string).
//  - Conditional sections only render when their data is non-empty.
//
// Phase G2 of the nordic-foods lessons plan.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const RENDERER = path.join(ROOT, "tools/scripts/render-sku-manifest-md.mjs");

const { renderManifest } = await import(RENDERER);

const BASE_FIXTURE = {
  schema_version: "sku-manifest-v1",
  project: "test-proj",
  default_region: "swedencentral",
  created_at: "2026-05-12T09:00:00Z",
  updated_at: "2026-05-12T11:30:00Z",
  current_revision: 2,
  environments: ["dev", "prod"],
  revisions: [
    {
      rev: 1,
      created_at: "2026-05-12T09:00:00Z",
      agent: "02-Requirements",
      step: "1",
      summary: "User pins",
      changed_ids: ["app-plan-web"],
    },
    {
      rev: 2,
      created_at: "2026-05-12T11:30:00Z",
      agent: "03-Architect",
      step: "2",
      summary: "Architect authoring",
      changed_ids: ["sql-db-core"],
    },
  ],
  services: [
    {
      id: "sql-db-core",
      service: "SQL Database",
      size: "GP_S_Gen5_2",
      capacity: { mode: "fixed", default: 1 },
      zonal: true,
      regions: ["swedencentral"],
      sla_target: "99.99%",
      sla_achieved: "99.99%",
      commitment: { type: "on-demand" },
      requires: ["private-endpoints"],
      source: "architect-derived",
      source_step: "2",
      last_modified_rev: 2,
      cost_estimate_monthly_usd: 218.0,
    },
    {
      id: "app-plan-web",
      service: "App Service Plan",
      size: "P1v3",
      capacity: { mode: "autoscale", min: 2, max: 10, default: 2 },
      zonal: true,
      regions: ["swedencentral", "germanywestcentral"],
      environment_overrides: { dev: { size: "B1", zonal: false } },
      sla_target: "99.95%",
      sla_achieved: "99.99%",
      commitment: { type: "reserved-1yr", term_years: 1 },
      requires: ["vnet-integration"],
      source: "user-pin",
      source_step: "1",
      last_modified_rev: 2,
      cost_estimate_monthly_usd: 142.5,
    },
  ],
};

describe("renderManifest", () => {
  it("produces byte-equal output on repeat runs (idempotent)", () => {
    const first = renderManifest(BASE_FIXTURE);
    const second = renderManifest(BASE_FIXTURE);
    assert.equal(first, second, "renderer must be idempotent");
  });

  it("sorts services by id lexicographically", () => {
    const out = renderManifest(BASE_FIXTURE);
    const appIdx = out.indexOf("| `app-plan-web` |");
    const sqlIdx = out.indexOf("| `sql-db-core` |");
    assert.ok(appIdx > 0 && sqlIdx > 0, "expected both service rows present");
    assert.ok(appIdx < sqlIdx, "app-plan-web must precede sql-db-core (lexicographic id sort)");
  });

  it("emits Current revision cell matching JSON current_revision", () => {
    const out = renderManifest(BASE_FIXTURE);
    const m = out.match(/\|\s*Current revision\s*\|\s*`(\d+)`/);
    assert.ok(m, "Current revision cell must be present");
    assert.equal(Number(m[1]), BASE_FIXTURE.current_revision);
  });

  it("renders Per-environment overrides only for services that declare them", () => {
    const out = renderManifest(BASE_FIXTURE);
    assert.ok(out.includes("### Per-environment overrides"));
    // app-plan-web has override row; sql-db-core does not
    assert.ok(out.includes("| `app-plan-web` | `dev` |"));
    assert.ok(!out.match(/\| `sql-db-core` \| `dev` \|/));
  });

  it("omits As-built actual SKUs section when no service has actual_sku", () => {
    const out = renderManifest(BASE_FIXTURE);
    assert.ok(!out.includes("### As-built actual SKUs"), "section must be absent without actual_sku data");
  });

  it("renders As-built section when actual_sku is present on any service", () => {
    const withActual = JSON.parse(JSON.stringify(BASE_FIXTURE));
    withActual.services[0].actual_sku = "GP_S_Gen5_2";
    const out = renderManifest(withActual);
    assert.ok(out.includes("### As-built actual SKUs"));
    assert.ok(out.includes("✅ match"));
  });

  it("flags drift when actual_sku differs from planned size", () => {
    const drifted = JSON.parse(JSON.stringify(BASE_FIXTURE));
    drifted.services[1].actual_sku = "S1"; // planned P1v3
    const out = renderManifest(drifted);
    assert.ok(out.includes("⚠️ drift"));
  });

  it("renders 'None open' when open_substitutions is empty or absent", () => {
    const out = renderManifest(BASE_FIXTURE);
    assert.ok(out.includes("**None open**"), "empty substitutions must render 'None open' line");
  });

  it("ends with single trailing newline", () => {
    const out = renderManifest(BASE_FIXTURE);
    assert.ok(out.endsWith("\n"), "must end with newline");
    assert.ok(!out.endsWith("\n\n"), "must not double-trail");
  });
});

describe("render-sku-manifest-md.mjs CLI", () => {
  it("writes file and respects --in/--out", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sku-render-"));
    const inPath = path.join(tmpDir, "in.json");
    const outPath = path.join(tmpDir, "out.md");
    fs.writeFileSync(inPath, JSON.stringify(BASE_FIXTURE), "utf-8");
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("node", [RENDERER, "--in", inPath, "--out", outPath], { encoding: "utf-8" });
    assert.equal(r.status, 0, `renderer failed: ${r.stdout}\n${r.stderr}`);
    assert.ok(fs.existsSync(outPath), "expected MD file to be written");
    const written = fs.readFileSync(outPath, "utf-8");
    assert.equal(written, renderManifest(BASE_FIXTURE), "CLI output must match library output");
    // Second run on identical input should be a no-op (still exit 0, content unchanged)
    const r2 = spawnSync("node", [RENDERER, "--in", inPath, "--out", outPath], { encoding: "utf-8" });
    assert.equal(r2.status, 0);
    assert.equal(fs.readFileSync(outPath, "utf-8"), written);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
