#!/usr/bin/env node
/**
 * SKU Manifest Markdown Renderer
 *
 * Renders `agent-output/{project}/sku-manifest.json` to a deterministic,
 * idempotent Markdown view at `agent-output/{project}/sku-manifest.md`.
 * The Markdown file is a read-only rendering — agents must mutate the JSON
 * and re-run this renderer, never hand-edit the MD.
 *
 * Contract (per Phase G1 of the nordic-foods lessons plan):
 *   - Simple placeholders ({project-name}, {default_region}, {current_revision},
 *     {updated_at}) substituted from JSON.
 *   - Array placeholders ({environments[]} comma-joined; {services[]}
 *     row-per-entry).
 *   - Conditional sections: Per-environment overrides renders only services
 *     with non-empty environment_overrides; As-built actual SKUs renders only
 *     when at least one service has actual_sku.
 *   - Deterministic ordering: services by `id` lexicographic.
 *   - Idempotent: byte-equal output on repeat runs (no timestamps captured
 *     at render time — all dates come from the JSON).
 *
 * Usage:
 *   node tools/scripts/render-sku-manifest-md.mjs <project>
 *   node tools/scripts/render-sku-manifest-md.mjs --in <json-path> --out <md-path>
 *
 * Exit codes:
 *   0 — rendered successfully (or MD already up-to-date)
 *   1 — JSON missing, malformed, or revision mismatch self-check failed
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { project: null, in: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (!a.startsWith("--") && !args.project) args.project = a;
  }
  return args;
}

function resolvePaths(args) {
  if (args.in && args.out) return { inPath: path.resolve(args.in), outPath: path.resolve(args.out) };
  if (!args.project) {
    console.error("Usage: render-sku-manifest-md.mjs <project> | --in <json> --out <md>");
    process.exit(1);
  }
  const projDir = path.join(ROOT, "agent-output", args.project);
  return {
    inPath: path.join(projDir, "sku-manifest.json"),
    outPath: path.join(projDir, "sku-manifest.md"),
  };
}

// ── Rendering helpers ───────────────────────────────────────────────────────

const CHECK = "✅";
const CROSS = "❌";

function fmtZonal(zonal) {
  if (zonal === true) return CHECK;
  if (zonal === false) return CROSS;
  return "—";
}

function fmtCapacity(cap) {
  if (!cap || typeof cap !== "object") return "—";
  const mode = cap.mode ?? "—";
  if (mode === "autoscale") {
    const min = cap.min ?? "—";
    const max = cap.max ?? "—";
    const def = cap.default ?? "—";
    return `\`${mode}: ${min}-${max} (default ${def})\``;
  }
  const def = cap.default ?? "—";
  return `\`${mode} (default ${def})\``;
}

function fmtCommitment(c) {
  if (!c || typeof c !== "object") return "`on-demand`";
  if (c.type === "on-demand") return "`on-demand`";
  if (c.term_years) return `\`${c.type}\` (\`${c.term_years}yr\`)`;
  return `\`${c.type}\``;
}

function fmtRegions(regions) {
  if (!Array.isArray(regions) || regions.length === 0) return "—";
  return regions.map((r) => `\`${r}\``).join(", ");
}

function fmtSla(svc) {
  const target = svc.sla_target ?? "—";
  const achieved = svc.sla_achieved ?? "—";
  return `\`${target}\` / \`${achieved}\``;
}

function fmtRequires(svc) {
  const r = svc.requires ?? [];
  if (r.length === 0) return "—";
  return r.map((x) => `\`${x}\``).join(", ");
}

function mdEscape(s) {
  if (s == null) return "";
  // Escape backslashes first, then pipes, so we don't double-escape.
  return String(s).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

// ── Section builders ────────────────────────────────────────────────────────

function renderHeader(json) {
  return [
    `# 📦 SKU Manifest - ${json.project}`,
    "",
    "![Artifact](https://img.shields.io/badge/Artifact-SKU%20Manifest-blue?style=for-the-badge)",
    "![Status](https://img.shields.io/badge/Status-Draft-orange?style=for-the-badge)",
    "![Schema](https://img.shields.io/badge/Schema-sku--manifest--v1-purple?style=for-the-badge)",
    "",
    "<details open>",
    "<summary><strong>📑 Manifest Contents</strong></summary>",
    "",
    "- [Overview](#overview)",
    "- [Environments](#environments)",
    "- [Services](#services)",
    "- [Revision History](#revision-history)",
    "- [Open Substitutions](#open-substitutions)",
    "",
    "</details>",
    "",
    `> Rendered from \`sku-manifest.json\` (rev ${json.current_revision}) by \`tools/scripts/render-sku-manifest-md.mjs\`.`,
    ">",
    "> **Do not hand-edit this file.** Mutate `sku-manifest.json` and re-run",
    "> the renderer (wired into lefthook + CI). Authoring rules:",
    "> [`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md).",
    "",
  ];
}

function renderOverview(json) {
  const envs = (json.environments ?? []).join(", ") || "—";
  const serviceCount = (json.services ?? []).length;
  return [
    "## Overview",
    "",
    "| Field            | Value                                                      |",
    "| ---------------- | ---------------------------------------------------------- |",
    `| Project          | \`${json.project}\`                                        |`,
    `| Default region   | \`${json.default_region}\` (per-service \`regions[]\` inherits this) |`,
    "| Schema version   | `sku-manifest-v1`                                          |",
    `| Current revision | \`${json.current_revision}\`                               |`,
    `| Last updated     | \`${json.updated_at}\`                                     |`,
    `| Environments     | \`${envs}\` (comma-separated)                              |`,
    `| Service count    | \`${serviceCount}\`                                        |`,
    "",
    "**Scope**: creative SKU decisions only — App Service plans, VMs/VMSS, SQL,",
    "Cosmos, AKS pools, Redis, APIM, App Gateway, Storage replication tiers.",
    "",
    "**Out of scope** (do not add to `services[]`): bandwidth, Log Analytics,",
    "vnet, subnet, NSG, route table, public IP, diagnostics. See",
    "[`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md).",
    "",
  ];
}

function renderEnvironments(json) {
  const envs = json.environments ?? [];
  if (envs.length === 0) {
    return ["## Environments", "", "_No environments declared._", ""];
  }
  const lines = ["## Environments", "", "| Environment | In scope | Notes |", "| ----------- | -------- | ----- |"];
  for (const e of envs) {
    lines.push(`| \`${e}\` | ${CHECK} | — |`);
  }
  lines.push("");
  return lines;
}

function renderServiceRow(svc) {
  const id = `\`${svc.id}\``;
  const service = mdEscape(svc.service ?? "—");
  const size = `\`${mdEscape(svc.size ?? "—")}\``;
  const capacity = fmtCapacity(svc.capacity);
  const zonal = fmtZonal(svc.zonal);
  const regions = fmtRegions(svc.regions);
  const sla = fmtSla(svc);
  const commitment = fmtCommitment(svc.commitment);
  const source = `\`${svc.source ?? "—"}\``;
  const rev = `\`${svc.last_modified_rev ?? "—"}\``;
  return `| ${id} | ${service} | ${size} | ${capacity} | ${zonal} | ${regions} | ${sla} | ${commitment} | ${source} | ${rev} |`;
}

function renderServices(json) {
  const services = [...(json.services ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const lines = [
    "## Services",
    "",
    "> Rendered from `sku-manifest.json` `services[]`. Per-environment values",
    "> reflect `environment_overrides` on top of the base entry.",
    "",
    "| `id` | Service | Size (base) | Capacity | Zonal | Regions | SLA target / achieved | Commitment | Source | Rev |",
    "| ---- | ------- | ----------- | -------- | ----- | ------- | --------------------- | ---------- | ------ | --- |",
  ];
  if (services.length === 0) {
    lines.push("| _none_ | — | — | — | — | — | — | — | — | — |");
  } else {
    for (const svc of services) lines.push(renderServiceRow(svc));
  }
  lines.push("");
  return { lines, services };
}

function renderOverrides(services) {
  const withOverrides = services.filter((s) => {
    const o = s.environment_overrides;
    return o && typeof o === "object" && Object.keys(o).length > 0;
  });
  const lines = ["### Per-environment overrides", ""];
  if (withOverrides.length === 0) {
    lines.push("_No services declare environment overrides._", "");
    return lines;
  }
  lines.push(
    "Only services with non-empty `environment_overrides` appear below.",
    "",
    "| `id` | Env | Size | Capacity | Zonal | Regions | Commitment | Notes |",
    "| ---- | --- | ---- | -------- | ----- | ------- | ---------- | ----- |",
  );
  for (const svc of withOverrides) {
    for (const env of Object.keys(svc.environment_overrides).sort()) {
      const ov = svc.environment_overrides[env];
      const size = `\`${ov.size ?? svc.size ?? "—"}\``;
      const cap = fmtCapacity(ov.capacity ?? svc.capacity);
      const zonal = fmtZonal(ov.zonal ?? svc.zonal);
      const regions = fmtRegions(ov.regions ?? svc.regions);
      const commit = fmtCommitment(ov.commitment ?? svc.commitment);
      const notes = mdEscape(ov.notes ?? "—");
      lines.push(`| \`${svc.id}\` | \`${env}\` | ${size} | ${cap} | ${zonal} | ${regions} | ${commit} | ${notes} |`);
    }
  }
  lines.push("");
  return lines;
}

function renderRequires(services) {
  const lines = [
    "### Feature requirements",
    "",
    "| `id` | `requires[]` | Verified at Step 4 |",
    "| ---- | ------------ | ------------------ |",
  ];
  if (services.length === 0) {
    lines.push("| _none_ | — | — |");
  } else {
    for (const svc of services) {
      lines.push(`| \`${svc.id}\` | ${fmtRequires(svc)} | ${CHECK} / ${CROSS} |`);
    }
  }
  lines.push("");
  return lines;
}

function renderCostEstimate(services) {
  const lines = [
    "### Cost estimate (USD/month)",
    "",
    "> Populated by `cost-estimate-subagent` via `manifest_writeback[]` —",
    "> Architect never types prices from parametric knowledge.",
    "",
    "| `id` | `cost_estimate_monthly_usd` | Confidence |",
    "| ---- | --------------------------- | ---------- |",
  ];
  let any = false;
  for (const svc of services) {
    if (svc.cost_estimate_monthly_usd === undefined || svc.cost_estimate_monthly_usd === null) continue;
    any = true;
    const cost = `\`$${Number(svc.cost_estimate_monthly_usd).toFixed(2)}\``;
    const conf = `\`${svc.cost_confidence ?? "—"}\``;
    lines.push(`| \`${svc.id}\` | ${cost} | ${conf} |`);
  }
  if (!any) lines.push("| _none priced yet_ | — | — |");
  lines.push("");
  return lines;
}

function renderActualSkus(services) {
  const withActual = services.filter((s) => s.actual_sku !== undefined && s.actual_sku !== null);
  if (withActual.length === 0) return [];
  const lines = [
    "### As-built actual SKUs",
    "",
    "> Populated by `08-As-Built` from deployed Azure state. Drift rows are flagged.",
    "",
    "| `id` | Env | Region | Planned `size` | `actual_sku` | Drift |",
    "| ---- | --- | ------ | -------------- | ------------ | ----- |",
  ];
  for (const svc of withActual) {
    const env = svc.actual_environment ?? "prod";
    const region = svc.actual_region ?? (svc.regions ?? [])[0] ?? "—";
    const planned = `\`${svc.size}\``;
    const actual = `\`${svc.actual_sku}\``;
    const drift = svc.actual_sku === svc.size ? `${CHECK} match` : `⚠️ drift`;
    lines.push(`| \`${svc.id}\` | \`${env}\` | \`${region}\` | ${planned} | ${actual} | ${drift} |`);
  }
  lines.push("");
  return lines;
}

function renderRevisions(json) {
  const lines = [
    "## Revision History",
    "",
    "> Append-only. Each row is metadata about a git commit / apex-recall checkpoint.",
    "",
    "| `rev` | Step | Agent | Created (UTC) | Summary | Changed `id`s | Commit | Checkpoint |",
    "| ----- | ---- | ----- | ------------- | ------- | ------------- | ------ | ---------- |",
  ];
  const revs = [...(json.revisions ?? [])].sort((a, b) => a.rev - b.rev);
  if (revs.length === 0) {
    lines.push("| _none_ | — | — | — | — | — | — | — |");
  } else {
    for (const rv of revs) {
      const ids = Array.isArray(rv.changed_ids) ? rv.changed_ids.map((x) => `\`${x}\``).join(", ") : "—";
      const commit = rv.commit_sha ? `\`${rv.commit_sha}\`` : "—";
      const ckpt = rv.apex_recall_checkpoint ? `\`${rv.apex_recall_checkpoint}\`` : "—";
      lines.push(
        `| \`${rv.rev}\` | \`${rv.step ?? "—"}\` | \`${rv.agent ?? "—"}\` | \`${rv.created_at ?? "—"}\` | ${mdEscape(rv.summary ?? "—")} | ${ids || "—"} | ${commit} | ${ckpt} |`,
      );
    }
  }
  lines.push("");
  return lines;
}

function renderOpenSubstitutions(json) {
  const subs = json.open_substitutions ?? [];
  const lines = [
    "## Open Substitutions",
    "",
    "> Captured at Step 6 (Deploy) when a planned SKU is unavailable due to",
    "> quota / region capacity. Mirrors `decisions.sku_overrides[]` in",
    "> `00-session-state.json`.",
    "",
  ];
  if (subs.length === 0) {
    lines.push("> **None open** — all SKUs deployed as planned.", "");
    return lines;
  }
  lines.push(
    "| `id` | Env / Region | Planned `size` | Substituted | Reason | Resolution |",
    "| ---- | ------------ | -------------- | ----------- | ------ | ---------- |",
  );
  for (const s of subs) {
    lines.push(
      `| \`${s.id}\` | \`${s.env}\` / \`${s.region}\` | \`${s.planned_size}\` | \`${s.substituted_size}\` | ${mdEscape(s.reason ?? "—")} | \`${s.resolution ?? "—"}\` |`,
    );
  }
  lines.push("");
  return lines;
}

function renderFooter() {
  return [
    "---",
    "",
    "## References",
    "",
    "- Schema: [`tools/schemas/sku-manifest.schema.json`](../../tools/schemas/sku-manifest.schema.json)",
    "- Authoring rules: [`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md)",
    "- Renderer: `node tools/scripts/render-sku-manifest-md.mjs <project>`",
    "- Validators: `npm run validate:sku-manifest` + `npm run validate:sku-iac-coverage`",
    "",
  ];
}

// ── Self-validation ─────────────────────────────────────────────────────────

function selfValidate(json, rendered) {
  // Re-parse "Current revision" cell from rendered markdown
  const m = rendered.match(/\|\s*Current revision\s*\|\s*`(\d+)`/);
  if (!m) throw new Error("Self-check failed: rendered MD missing 'Current revision' cell");
  const renderedRev = Number(m[1]);
  if (renderedRev !== json.current_revision) {
    throw new Error(
      `Self-check failed: rendered current_revision (${renderedRev}) != JSON current_revision (${json.current_revision})`,
    );
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

export function renderManifest(json) {
  const { lines: serviceLines, services } = renderServices(json);
  const sorted = services;
  const out = [
    ...renderHeader(json),
    ...renderOverview(json),
    ...renderEnvironments(json),
    ...serviceLines,
    ...renderOverrides(sorted),
    ...renderRequires(sorted),
    ...renderCostEstimate(sorted),
    ...renderActualSkus(sorted),
    ...renderRevisions(json),
    ...renderOpenSubstitutions(json),
    ...renderFooter(),
  ];
  // Ensure trailing newline, single (deterministic)
  let text = out.join("\n");
  if (!text.endsWith("\n")) text += "\n";
  return text;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { inPath, outPath } = resolvePaths(args);

  if (!fs.existsSync(inPath)) {
    console.error(`[render-sku-manifest-md] JSON not found: ${inPath}`);
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(fs.readFileSync(inPath, "utf-8"));
  } catch (err) {
    console.error(`[render-sku-manifest-md] Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  let rendered;
  try {
    rendered = renderManifest(json);
    selfValidate(json, rendered);
  } catch (err) {
    console.error(`[render-sku-manifest-md] ${err.message}`);
    process.exit(1);
  }

  // Idempotency check — if existing MD matches byte-for-byte, skip write
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, "utf-8");
    if (existing === rendered) {
      console.log(`[render-sku-manifest-md] ${path.relative(ROOT, outPath)} already up-to-date`);
      return 0;
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rendered, "utf-8");
  console.log(`[render-sku-manifest-md] Wrote ${path.relative(ROOT, outPath)} (rev ${json.current_revision})`);
  return 0;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  process.exit(main());
}
