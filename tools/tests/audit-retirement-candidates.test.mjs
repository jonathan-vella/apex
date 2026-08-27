import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventory,
  domainFor,
  parseLsFiles,
  protectionFor,
  renderMarkdown,
  stableFileId,
  validateCoverage,
  validateScan,
} from "../scripts/audit-retirement-candidates.mjs";

const BASELINE = "b87b57f719520049d6bcf2f00bc3d9431c1002a7";
const BRANCH = "chore/whole-repo-retirement-scan-2026-08-27";
let cachedScan;

function scan() {
  cachedScan ??= buildInventory({ baseline: BASELINE, branch: BRANCH });
  return cachedScan;
}

test("parses NUL-delimited Git index records including spaces and modes", () => {
  const input = Buffer.from(
    "100755 0123456789012345678901234567890123456789 0\ttools/a script.sh\0" +
      "120000 abcdefabcdefabcdefabcdefabcdefabcdefabcd 0\tlinked file\0",
  );
  assert.deepEqual(parseLsFiles(input), [
    {
      mode: "120000",
      sha: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
      stage: 0,
      path: "linked file",
    },
    {
      mode: "100755",
      sha: "0123456789012345678901234567890123456789",
      stage: 0,
      path: "tools/a script.sh",
    },
  ]);
});

test("stable IDs are deterministic and path-sensitive", () => {
  assert.equal(stableFileId("README.md"), stableFileId("README.md"));
  assert.notEqual(stableFileId("README.md"), stableFileId("AGENTS.md"));
  assert.match(stableFileId("README.md"), /^FILE-[0-9a-f]{12}$/);
});

test("classifies repository domains and protected dynamic entrypoints", () => {
  assert.equal(domainFor(".github/agents/01-orchestrator.agent.md"), "agents");
  assert.equal(domainFor("tools/tests/example.test.mjs"), "tests");
  assert.equal(protectionFor(".github/skills/azure-rbac/SKILL.md"), "auto_discovered_skill");
  assert.equal(protectionFor("site/public/downloads/demo.zip"), "published_download");
  assert.equal(protectionFor("README.md"), null);
});

test("builds a schema-valid complete baseline inventory", () => {
  const result = scan();
  const validation = validateScan(result);
  assert.equal(validation.valid, true, JSON.stringify(validation, null, 2));
  assert.equal(result.inventory.length, result.statistics.total_files);
  assert.equal(new Set(result.inventory.map((item) => item.path)).size, result.inventory.length);
  assert.equal(result.approval.human_required, true);
  assert.equal(result.approval.state, "pending");
  assert.deepEqual(result.scan_findings, []);
});

test("protects dynamic and structural content from automatic retirement", () => {
  const result = scan();
  const byPath = new Map(result.inventory.map((item) => [item.path, item]));
  assert.equal(byPath.get(".github/agents/01-orchestrator.agent.md").status, "protected");
  assert.equal(byPath.get("tools/schemas/sku-manifest.schema.json").status, "protected");
  assert.equal(byPath.get("site/public/downloads/bmit-2026.zip").status, "protected");
});

test("groups exact duplicates without approving retirement", () => {
  const result = scan();
  const duplicateItems = result.inventory.filter((item) => item.duplication.exact_duplicate_group);
  assert.ok(duplicateItems.length > 0);
  assert.ok(duplicateItems.every((item) => item.status !== "candidate"));
  assert.ok(result.candidate_groups.some((group) => group.kind === "exact_duplicate"));
  assert.ok(
    result.candidate_groups
      .filter((group) => group.kind === "exact_duplicate")
      .every((group) => /^DUP-[0-9a-f]{12}$/.test(group.id)),
  );
});

test("records repository ownership for every baseline file", () => {
  const result = scan();
  assert.ok(result.inventory.every((item) => item.ownership.codeowners.length > 0));
});

test("resolves duplicated reference filenames relative to their owning skill", () => {
  const result = scan();
  const identity = result.inventory.find(
    (item) => item.path === ".github/skills/azure-deploy/references/sdk/azure-identity-py.md",
  );
  assert.deepEqual(identity.reachability.direct_references, [".github/skills/azure-deploy/SKILL.md"]);
});

test("repeated scans have deterministic semantic output", () => {
  const first = scan();
  const second = buildInventory({ baseline: BASELINE, branch: BRANCH });
  assert.deepEqual(second, first);
  assert.equal(renderMarkdown(second), renderMarkdown(first));
});

test("coverage validation rejects missing and duplicate paths", () => {
  const result = structuredClone(scan());
  result.inventory.push(result.inventory[0]);
  result.inventory.splice(1, 1);
  const coverage = validateCoverage(result, BASELINE);
  assert.equal(coverage.valid, false);
  assert.ok(coverage.duplicates.length > 0);
  assert.ok(coverage.missing.length > 0);
});
