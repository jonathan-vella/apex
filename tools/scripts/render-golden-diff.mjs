#!/usr/bin/env node
/**
 * render-golden-diff.mjs (T-003)
 *
 * Generates an HTML viewer with side-by-side panels of the captured baseline
 * .drawio files (G1..G7, "before") and the post-uplift recapture ("after").
 * Each panel embeds the Draw.io viewer via the public viewer.diagrams.net
 * iframe — no local rendering pipeline required, no Puppeteer, no Cairo.
 *
 * Inputs:
 *   - Baseline:  agent-output/gN-<slug>/03-des-diagram.drawio  (committed,
 *                where N is 1 through 7)
 *   - Post-run:  agent-output/_bench/drawio-quality-uplift/<run-id>/
 *                <scenario>/03-des-diagram.drawio              (collected
 *                                                              after the
 *                                                              user re-runs
 *                                                              G1..G7 through
 *                                                              the updated
 *                                                              04-Design)
 *
 * Output:
 *   agent-output/_bench/drawio-quality-uplift/<run-id>/diff-index.html
 *   plus one diff-<scenario>.html per scenario.
 *
 * Usage:
 *   node tools/scripts/render-golden-diff.mjs --post=<run-id>
 *   node tools/scripts/render-golden-diff.mjs --post=<run-id> --open
 *
 * Open the resulting HTML in any browser. The Draw.io viewer renders the
 * embedded XML inline (no external network beyond the viewer JS itself).
 */

import fs from "node:fs";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) return [];
    return [[m[1], m[2] ?? "true"]];
  }),
);
const POST_RUN_ID = args.get("post");
const OPEN_FLAG = args.has("open");

if (!POST_RUN_ID) {
  console.error(
    `❌ usage: node tools/scripts/render-golden-diff.mjs --post=<run-id>\n` +
      `   <run-id> is the directory under agent-output/_bench/drawio-quality-uplift/\n` +
      `   where the post-uplift G1..G7 .drawio files are collected.`,
  );
  process.exit(1);
}

const SCENARIOS = [
  {
    id: "g1-three-tier-web",
    title: "G1 — Three-Tier Web App",
    baseline: "agent-output/g1-three-tier/03-des-diagram.drawio",
  },
  {
    id: "g2-hub-spoke-landing-zone",
    title: "G2 — Hub-Spoke Landing Zone",
    baseline: "agent-output/g2-hub-spoke/03-des-diagram.drawio",
  },
  {
    id: "g3-event-driven-microservices",
    title: "G3 — Event-Driven Microservices",
    baseline: "agent-output/g3-event-driven-microservices/03-des-diagram.drawio",
  },
  {
    id: "g4-ml-training-pipeline",
    title: "G4 — ML Training Pipeline",
    baseline: "agent-output/g4-ml-training/03-des-diagram.drawio",
  },
  {
    id: "g5-enterprise-landing-zone",
    title: "G5 — Enterprise Landing Zone",
    baseline: "agent-output/g5-enterprise-landing-zone/03-des-diagram.drawio",
  },
  {
    id: "g6-hyperscale-platform",
    title: "G6 — Hyperscale Platform",
    baseline: "agent-output/g6-hyperscale-platform/03-des-diagram.drawio",
  },
  {
    id: "g7-multi-region-active-active",
    title: "G7 — Multi-Region Active-Active",
    baseline: "agent-output/g7-multi-region-active-active/03-des-diagram.drawio",
  },
];

const RUN_DIR = path.join("agent-output", "_bench", "drawio-quality-uplift", POST_RUN_ID);
fs.mkdirSync(RUN_DIR, { recursive: true });

function readMaybe(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Draw.io viewer's `?xml=` parameter accepts URI-encoded XML, but for large
// diagrams the URL gets too long. The reliable embed pattern is to inject
// the XML into a `<div class="mxgraph">` element with `data-mxgraph` JSON;
// the viewer.js script reads from there. This avoids per-diagram URL limits.
function embedDrawio(xmlString, label) {
  if (!xmlString) {
    return `<div class="missing">⚠️ ${label} not found</div>`;
  }
  // The viewer expects { highlight, lightbox, nav, toolbar, edit, xml }.
  // toolbar=zoom,layers,lightbox keeps the side-by-side compact.
  const cfg = {
    highlight: "#0078D4",
    lightbox: true,
    nav: true,
    toolbar: "zoom layers lightbox",
    edit: "_blank",
    xml: xmlString,
  };
  return `<div class="mxgraph" style="max-width:100%; border:1px solid #e1e4e8; background:#fafbfc;" data-mxgraph='${escapeHtml(JSON.stringify(cfg))}'></div>`;
}

function renderScenarioPage(scenario) {
  const beforeXml = readMaybe(scenario.baseline);
  const afterPath = path.join(RUN_DIR, scenario.id, "03-des-diagram.drawio");
  const afterXml = readMaybe(afterPath);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(scenario.title)} — diff (${escapeHtml(POST_RUN_ID)})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           margin: 16px; background: #f6f8fa; color: #24292e; }
    h1 { margin: 0 0 8px; }
    h2 { margin: 8px 0 4px; font-size: 14px; color: #586069; text-transform: uppercase; letter-spacing: 0.05em; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: #fff; border: 1px solid #e1e4e8; border-radius: 6px; padding: 12px; }
    .panel-header { font-weight: 600; margin-bottom: 4px; }
    .panel-meta { color: #586069; font-size: 12px; margin-bottom: 8px; font-family: ui-monospace, monospace; }
    .missing { color: #d73a49; padding: 24px; text-align: center; background: #ffeef0; border-radius: 4px; }
    nav { margin-bottom: 16px; }
    nav a { color: #0366d6; text-decoration: none; margin-right: 12px; }
  </style>
</head>
<body>
  <nav><a href="diff-index.html">← back to index</a></nav>
  <h1>${escapeHtml(scenario.title)}</h1>
  <div class="pair">
    <section class="panel">
      <div class="panel-header">Baseline (pre-uplift)</div>
      <div class="panel-meta">${escapeHtml(scenario.baseline)}</div>
      <h2>Diagram</h2>
      ${embedDrawio(beforeXml, "baseline")}
    </section>
    <section class="panel">
      <div class="panel-header">Post-uplift (run ${escapeHtml(POST_RUN_ID)})</div>
      <div class="panel-meta">${escapeHtml(afterPath)}</div>
      <h2>Diagram</h2>
      ${embedDrawio(afterXml, "post-uplift")}
    </section>
  </div>
  <script type="text/javascript" src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body>
</html>
`;
  const out = path.join(RUN_DIR, `diff-${scenario.id}.html`);
  fs.writeFileSync(out, html);
  return { out, hasBaseline: !!beforeXml, hasPost: !!afterXml };
}

const results = SCENARIOS.map((s) => ({
  scenario: s,
  ...renderScenarioPage(s),
}));

// Index page
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Draw.io Quality Uplift — diff index (${escapeHtml(POST_RUN_ID)})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           margin: 24px; background: #f6f8fa; color: #24292e; }
    h1 { margin: 0 0 12px; }
    p { color: #586069; }
    table { width: 100%; border-collapse: collapse; background: #fff;
            border: 1px solid #e1e4e8; border-radius: 6px; overflow: hidden; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e1e4e8; }
    th { background: #f6f8fa; font-weight: 600; }
    a { color: #0366d6; text-decoration: none; }
    .ok { color: #22863a; }
    .missing { color: #d73a49; }
  </style>
</head>
<body>
  <h1>Draw.io Quality Uplift — diff index</h1>
  <p>Run: <code>${escapeHtml(POST_RUN_ID)}</code> · Baseline: T-012 captures committed at branch HEAD ·
    Generated: ${new Date().toISOString()}</p>
  <table>
    <thead>
      <tr><th>Scenario</th><th>Baseline</th><th>Post-uplift</th><th></th></tr>
    </thead>
    <tbody>
      ${results
        .map(
          (r) => `
      <tr>
        <td>${escapeHtml(r.scenario.title)}</td>
        <td class="${r.hasBaseline ? "ok" : "missing"}">${r.hasBaseline ? "✅ found" : "❌ missing"}</td>
        <td class="${r.hasPost ? "ok" : "missing"}">${r.hasPost ? "✅ found" : "⚠️ awaiting recapture"}</td>
        <td><a href="diff-${escapeHtml(r.scenario.id)}.html">view →</a></td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
`;
const indexOut = path.join(RUN_DIR, "diff-index.html");
fs.writeFileSync(indexOut, indexHtml);

console.log(`Wrote ${results.length} scenario pages to:`);
console.log(`  ${RUN_DIR}/`);
console.log(`Index: ${indexOut}`);
const missing = results.filter((r) => !r.hasPost).length;
if (missing > 0) {
  console.log(
    `\n⚠️  ${missing}/${results.length} scenario(s) missing post-uplift .drawio.\n` +
      `   Re-run G1..G7 through the updated 04-Design agent and copy each\n` +
      `   resulting 03-des-diagram.drawio into ${RUN_DIR}/<scenario-id>/`,
  );
}

if (OPEN_FLAG) {
  console.log(`\nOpen in browser: file://${path.resolve(indexOut)}`);
}
