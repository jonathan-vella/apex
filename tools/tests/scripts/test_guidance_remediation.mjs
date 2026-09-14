import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { runFetcher } from "../../scripts/fetch-vendor-prompting-guides.mjs";
import { ARTIFACT_HEADINGS } from "../../scripts/_lib/artifact-headings.mjs";

const root = new URL("../../../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const skill = (file) => read(`.github/skills/${file}`);

test("SK25: templates preserve governed headings without deciding completion or routing", () => {
  for (const name of [
    "02-architecture-assessment",
    "04-implementation-plan",
    "04-governance-constraints",
    "04-preflight-check",
  ]) {
    const template = skill(`apex-azure-artifacts/templates/${name}.template.md`);
    const headings = template.split("\n").filter((line) => line.startsWith("## "));
    const required = ARTIFACT_HEADINGS[`${name}.md`];
    assert.deepEqual(headings.slice(0, required.length), required, name);
    if (name.startsWith("04-")) {
      const summary = skill("apex-azure-artifacts/references/04-plan-template.md");
      const section = summary.split(`### ${name}.md`)[1].split("### ")[0];
      const summarized = section.split("\n").filter((line) => line.startsWith("## "));
      assert.deepEqual(
        summarized.filter((heading) => heading !== "## References"),
        required,
      );
      for (const heading of headings.filter((heading) => !required.includes(heading))) {
        assert.ok(section.includes(heading), `${name}: preserve ${heading}`);
      }
    }
  }
  const architecture = skill("apex-azure-artifacts/templates/02-architecture-assessment.template.md");
  assert.doesNotMatch(architecture, /proceed to iac-planner|architecture is approved for implementation/);
  assert.match(architecture, /decisions.skip_design/);
  assert.match(architecture, /independent cost-feasibility/);
  assert.match(skill("apex-azure-artifacts/SKILL.md"), /a write alone is not completion/);
  const readme = skill("apex-azure-artifacts/templates/PROJECT-README.template.md");
  assert.match(readme, /3\.5\s+\| Governance/);
  assert.match(readme, /Generated files are not completed steps/);
});

test("SK23: VNet guidance preserves Azure reserved addresses, Overlay separation and all prefixes", () => {
  const body = skill("apex-azure-defaults/references/vnet-planning.md");
  const row = body.split("\n").find((line) => line.includes("**Private Endpoint subnet**"));
  for (const [prefix, total, usable] of [
    [29, 8, 3],
    [27, 32, 27],
  ]) {
    assert.equal(2 ** (32 - prefix) - 5, usable);
    assert.ok(row.includes(`/${prefix}\` = ${total} total / ${usable} usable`));
  }
  assert.match(body, /Pods use a separate non-overlapping pod CIDR, not VNet IPs/);
  assert.match(body, /preserve all live `addressSpace.addressPrefixes`/);
  assert.doesNotMatch(body, /5 usable IPs|trust user input|addressPrefixes\[0\]/);
  assert.match(body, /block confirmation\/codegen\/deployment/);
  const gates = skill("apex-azure-defaults/references/workflow-gates.md");
  assert.doesNotMatch(gates, /Same-region \(silent default\)|trust user input|addressPrefixes\[0\]/);
});

test("SK21: exact AVM interfaces and full anomaly-view IDs control validation", () => {
  const defaults = skill("apex-azure-defaults/references/security-baseline-full.md");
  assert.match(defaults, /workspace:0\.15\.1/);
  assert.doesNotMatch(defaults, /dailyQuotaGb` is `int` in AVM/);
  assert.match(defaults, /interface remains unknown/);
  const pitfalls = skill("apex-azure-bicep-patterns/references/avm-pitfalls.md");
  assert.match(pitfalls, /pending explicit\s+version validation/);
  assert.doesNotMatch(pitfalls, /python3 - <<|safe to ignore/);
  const checklist = skill("apex-azure-defaults/references/adversarial-checklists.md");
  assert.match(checklist, /ByResourceGroup` describes grouping/);
  const snippets = skill("apex-azure-defaults/references/cost-alerts-bicep.md");
  const identifier = "${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup";
  assert.ok(checklist.includes(identifier));
  assert.ok(snippets.includes(identifier));
});

test("SK24: governance confirms current inputs before review and recovers full blocker evidence", () => {
  const resolution = skill("apex-azure-governance-discovery/references/inline-resolution-gate.md");
  assert.match(resolution, /before challenger review/);
  assert.match(resolution, /captured \*\*before discovery\*\*/);
  assert.match(resolution, /subscription, target region/);
  assert.match(resolution, /0 <= age_days/);
  assert.match(resolution, /Unknown — block/);
  const commands = skill("apex-azure-governance-discovery/references/terminal-commands.md");
  assert.match(commands, /every blocker, including overflow/);
  assert.match(commands, /Targeted follow-up queries are required/);
  assert.doesNotMatch(commands, /sed -n '1,120p'|2>\/dev\/null \|\| echo 0|do NOT issue follow-up/);
  assert.match(commands, /explicit\s+human approval/);
});

test("shared retries cannot reset, skip gates or apply unapproved substitutions", () => {
  const body = skill("apex-iac-common/SKILL.md");
  const breaker = skill("apex-iac-common/references/circuit-breaker.md");
  for (const text of [body, breaker]) {
    for (const option of ["proceed-with-substitute", "change-region", "abort"]) assert.ok(text.includes(option));
    assert.match(text, /explicit approval/);
    assert.doesNotMatch(text, /Reset and retry|Skip step \(marks as skipped/);
  }
  assert.match(body, /stricter one identical-input retry/);
  assert.match(
    skill("apex-iac-common/references/deploy-shared-workflow.md"),
    /partial success is not completed deployment/,
  );
});

test("SK10: reachable dispatch guidance preserves main-agent boundaries and graph review floors", () => {
  for (const file of ["subagent-integration.md", "orchestrator-handoff-guide.md"]) {
    const body = skill(`apex-workflow-engine/references/${file}`);
    assert.match(body, /workflow-graph.json/);
    assert.match(body, /human-selected/);
    assert.match(body, /exactly one identical-input retry/);
    assert.match(body, /cost-feasibility/);
    assert.doesNotMatch(body, /`#runSubagent` OK|silently fall back to codex|within ceiling|invoke it now/);
  }
  const graph = JSON.parse(skill("apex-workflow-engine/templates/workflow-graph.json"));
  assert.deepEqual(graph.nodes["step-2"].challenger.default_lenses, ["comprehensive", "cost-feasibility"]);
  assert.equal(graph.nodes["step-5b"].challenger.default_passes, 0);
  assert.equal(graph.nodes["step-5t"].challenger.default_passes, 0);
});

test("SK34: the summary maps every unique principle to the canonical union", () => {
  const body = skill("apex-golden-principles/SKILL.md");
  const reference = skill("apex-golden-principles/references/principles.md");
  const titles = [...body.split("## Steps")[0].matchAll(/^\d+\. \*\*([^*]+)\*\* /gm)].map((match) => match[1]);
  assert.equal(titles.length, 14);
  for (const [index, title] of titles.entries()) assert.ok(reference.includes(`## ${index + 1}. ${title}`), title);
  for (const original of [
    "Body 7",
    "Body 8",
    "Body 9",
    "Body 10",
    "Reference 7",
    "Reference 8",
    "Reference 9",
    "Reference 10",
  ]) {
    assert.ok(reference.includes(`| ${original} |`), original);
  }
  assert.match(reference, /No unique principle is dropped/);
  assert.match(reference, /unresolved blocker stop in every mode/);
  assert.match(reference, /exactly one identical-input retry/);
});

test("assigned ADR guidance preserves alternative coverage and phase naming", () => {
  const body = skill("apex-azure-adr/SKILL.md");
  const guardrails = skill("apex-azure-adr/references/guardrails.md");
  const checklist = skill("apex-azure-adr/references/quality-checklist.md");
  assert.match(body, /at least 2-3 considered and rejected/);
  assert.match(guardrails, /at least 2-3 alternatives considered/);
  assert.match(checklist, /At least 2 alternatives documented with rejection reasons/);
  for (const prefix of ["03-des-adr-", "07-ab-adr-"]) {
    assert.ok(body.includes(prefix));
    assert.ok(checklist.includes(prefix));
  }
  assert.match(checklist, /number is sequential/);
  assert.match(checklist, /Proposed for design, Accepted for as-built/);
  assert.match(checklist, /WAF pillar analysis includes all 5 pillars/);
});

test("SK32: compaction recovers required guidance without latency-derived tokens", () => {
  for (const file of ["SKILL.md", "references/skill-loading.md", "references/hard-checkpoints.md"]) {
    const body = skill(`apex-context-management/${file}`);
    assert.match(body, /reload missing\s+required guidance/);
    assert.doesNotMatch(body, /Stop loading additional skills|only once per session|pin further skill reads/);
  }
  assert.match(skill("apex-context-management/references/hard-checkpoints.md"), /not a truncation budget/);
  const estimation = skill("apex-context-management/references/token-estimation.md");
  assert.match(estimation, /Never infer tokens from latency/);
  assert.match(estimation, /missing telemetry explicitly unknown/);
  assert.doesNotMatch(estimation, /Latency < 5s|30% more tokens/);
  assert.doesNotMatch(skill("apex-context-management/templates/optimization-report.md"), /Latency-to-token estimates/);
});

for (const outcome of [
  "cached",
  "success",
  "changed",
  "failed",
  "unknown-cache",
  "modified-cache",
  "freshness-only",
  "repeat-cache",
]) {
  test(`SK33: offline fetch fixture preserves truthful provenance: ${outcome}`, async (context) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "apex-guidance-"));
    context.after(() => rmSync(rootDir, { recursive: true, force: true }));
    const directory = path.join(rootDir, ".github/skills/apex-vendor-prompting");
    const snapshots = path.join(directory, "references/.snapshots");
    mkdirSync(snapshots, { recursive: true });
    mkdirSync(path.join(rootDir, "tools/registry"), { recursive: true });
    const sha256 = createHash("sha256").update("old").digest("hex");
    const oldDate = "2026-01-01T00:00:00.000Z";
    const newDate = "2026-09-14T00:00:00.000Z";
    const prior = { source_id: "fixture", sha256, fetched_at: oldDate };
    writeFileSync(path.join(directory, "rules.json"), JSON.stringify({ sources: [{ id: "fixture", sha256 }] }));
    writeFileSync(
      path.join(snapshots, "manifest.json"),
      JSON.stringify(["unknown-cache", "freshness-only"].includes(outcome) ? [] : [prior]),
    );
    const freshness = {
      sources: outcome === "unknown-cache" ? [] : [{ source_id: "fixture", sha256, last_fetched: oldDate }],
    };
    const freshnessPath = path.join(rootDir, "tools/registry/source-freshness.json");
    writeFileSync(freshnessPath, JSON.stringify(freshness));
    if (outcome !== "failed")
      writeFileSync(path.join(snapshots, "fixture.md"), outcome === "modified-cache" ? "modified" : "old");
    const success = ["success", "changed"].includes(outcome);
    const options = {
      rootDir,
      now: () => newDate,
      args: ["--fail-on-drift"],
      sources: [
        {
          id: "fixture",
          url: "https://example.invalid",
          snapshotName: "fixture.md",
          fetch: async () =>
            success
              ? { ok: true, method: "raw", body: outcome === "changed" ? "new" : "old" }
              : { ok: false, error: "offline fixture" },
        },
      ],
    };
    const code = await runFetcher(options);
    assert.equal(code, outcome === "failed" ? 2 : ["changed", "modified-cache"].includes(outcome) ? 1 : 0);
    if (outcome === "repeat-cache") assert.equal(await runFetcher(options), 0);
    const [entry] = JSON.parse(readFileSync(path.join(snapshots, "manifest.json")));
    assert.equal(entry.attempted_at, newDate);
    assert.equal(
      entry.fetched_at,
      success ? newDate : ["unknown-cache", "modified-cache"].includes(outcome) ? null : oldDate,
    );
    assert.equal(entry.fetch_method, success ? "raw" : outcome === "failed" ? "failed" : "cached");
    if (!success) assert.equal(entry.error, "offline fixture");
    const updated = JSON.parse(readFileSync(freshnessPath));
    if (success) assert.equal(updated.sources[0].last_fetched, newDate);
    else assert.deepEqual(updated, freshness);
  });
}
