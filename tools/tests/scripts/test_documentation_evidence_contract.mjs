import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(`../../../${name}`, import.meta.url), "utf8");
const parentPath = ".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md";
const parent = read(parentPath);
const documentation = parent.split("### Product documentation and publication\n")[1]?.split("\n### ")[0];

test("billing documentation retains provenance and applicability without requiring full-page copies", () => {
  assert.ok(documentation, "The parent contract must define documentation publication rules");
  for (const field of ["source_url", "retrieved_at", "title", "billing_conclusion", "applicability", "limitations"]) {
    assert.ok(documentation.includes(`\`${field}\``), `Missing documentation field: ${field}`);
  }
  assert.match(documentation, /actual fetched source URL, not one inferred/);
  assert.match(documentation, /short original paraphrase/);
  assert.match(documentation, /outside the\s+repository/);
  assert.match(documentation, /license\/permission and attribution established before publication/);
  assert.match(documentation, /do not generalize a Learn license\s+to commercial pricing pages/);
  assert.match(documentation, /do not make full-page copies a pricing or review prerequisite/);
  assert.match(documentation, /Documentation does not replace native retail-rate evidence/);
});

test("legacy documentation repair preserves original bytes and historical review integrity", () => {
  assert.match(documentation, /obtain owner authorization for evidence repair/);
  assert.match(documentation, /Preserve the original\s+privately/);
  assert.match(documentation, /explicitly labelled provenance notice or original summary/);
  assert.match(documentation, /unknown source\/date without inventing metadata/);
  assert.match(documentation, /Keep historical review records and\s+hashes unchanged/);
  assert.match(documentation, /record the evidence change through recall/);
  assert.match(documentation, /independent\s+review under existing allowances/);
  assert.match(documentation, /Do not reset budgets,\s+restamp reviews/);
});

test("calling agents and shared guidance retain the documentation versus retail evidence boundary", () => {
  const architect = read(".github/agents/03-architect.agent.md");
  const asBuilt = read(".github/agents/08-as-built.agent.md");
  const leaf = read(".github/agents/_subagents/cost-estimate-subagent.agent.md");
  const guidance = read(".github/skills/apex-azure-defaults/references/pricing-guidance.md");
  for (const main of [architect, asBuilt]) assert.match(main, /cost-estimate-parent-contract\.md/);
  assert.match(architect, /source URL\/date, a short original conclusion, applicability and limitations/);
  assert.match(
    leaf,
    /Exact-byte capture applies to native retail API responses, not whole product-documentation pages/,
  );
  assert.match(leaf, /do not require or\s+create full-page documentation archives/);
  assert.match(leaf, /Missing applicability remains unresolved/);
  assert.match(guidance, /cost-estimate-parent-contract\.md#product-documentation-and-publication/);
  assert.match(guidance, /does not permit trimming, paraphrasing or replacing native retail API response bytes/);
  assert.match(read("AGENTS.md"), /Keep necessary full-text captures private outside Git/);
});

test("Git staging and checkout preserve exact artifact bytes without changing source normalization", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-evidence-attributes-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  fs.writeFileSync(path.join(root, ".gitattributes"), read(".gitattributes"));
  const bytes = Buffer.from("synthetic evidence  \r\nsecond line\r\n");
  const files = [
    "agent-output/fixture/contracts/quote.json.retail-evidence/response.json",
    "agent-output/fixture/_meta/02-pricing-public-docs/capture.native.txt",
    "agent-output/fixture/02-architecture-assessment.md",
    "agent-output/fixture/assets/chart.svg",
  ];
  for (const name of files) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), bytes);
  }
  fs.writeFileSync(path.join(root, "source.js"), bytes);
  git("add", "--", ".gitattributes", "source.js", ...files);
  for (const name of files) {
    assert.deepEqual(git("show", `:${name}`), bytes, `Staging altered evidence: ${name}`);
    fs.unlinkSync(path.join(root, name));
  }
  git("checkout-index", "--all", "--force");
  for (const name of files) {
    assert.deepEqual(fs.readFileSync(path.join(root, name)), bytes, `Checkout altered evidence: ${name}`);
  }
  assert.equal(git("show", ":source.js").toString(), bytes.toString().replaceAll("\r\n", "\n"));
});
