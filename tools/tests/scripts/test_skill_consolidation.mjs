import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

const skillsRoot = new URL("../../../.github/skills/", import.meta.url);
const deployRules = new URL("apex-azure-deploy/references/global-rules.md", skillsRoot);
const costQueries = new URL("apex-azure-cost-optimization/references/azure-resource-graph.md", skillsRoot);
const read = (file) => readFileSync(file, "utf8");
const headings = (source) => [...source.matchAll(/^#{1,6} (.+)$/gm)].map((match) => match[1]);
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\w -]/g, "")
    .replaceAll(" ", "-");

function linkedReference(file, label) {
  const links = [...read(file).matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  const link = links.find((match) => match[1] === label);
  assert.ok(link, `Missing required reference: ${label}`);
  return new URL(link[2], file);
}

function section(file, title) {
  const source = read(file);
  const marker = `## ${title}\n`;
  assert.ok(source.includes(marker), `Missing section: ${title}`);
  return source.split(marker)[1].split("\n## ")[0];
}

const kqlBlocks = (source) => [...source.matchAll(/```kql\n([\s\S]*?)```/g)].map((match) => match[1]);

const validator = fileURLToPath(new URL("../../scripts/validate-skills.mjs", import.meta.url));
const retiredName = ["azure", "troubleshooting"].join("-");

test("skill descriptions use installed identifiers for cross-skill redirects", () => {
  const installed = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("apex-"))
    .map((entry) => entry.name);
  const legacyNames = new Set(installed.map((name) => name.slice("apex-".length)));
  const stale = [];
  for (const name of installed) {
    const { description } = parseFrontmatter(read(new URL(`${name}/SKILL.md`, skillsRoot)));
    const exclusions = description.split("DO NOT USE FOR:")[1] ?? "";
    const redirects = [...exclusions.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
    for (const match of description.matchAll(/\b(?:use|invoke|load|route to)\s+`?([a-z][a-z0-9-]*)/g)) {
      redirects.push(match[1]);
    }
    for (const redirect of redirects) {
      for (const identifier of redirect.match(/[a-z][a-z0-9-]*/g) ?? []) {
        if (legacyNames.has(identifier)) stale.push(`${name}: ${identifier} -> apex-${identifier}`);
      }
    }
  }
  assert.deepEqual(stale, [], `Stale skill description redirects:\n${stale.join("\n")}`);
});

test("skill descriptions remain within the routing length cap", () => {
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const { description } = parseFrontmatter(read(new URL(`${entry.name}/SKILL.md`, skillsRoot)));
    assert.equal(typeof description, "string", entry.name);
    assert.ok(description.length <= 500, `${entry.name}: description is ${description.length} chars (max 500)`);
  }
});

function cliFixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "apex-skill-validation-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (relative, content) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const skill = (directory, nameField = `name: ${directory}`, description = "A valid routing description.") =>
    write(`.github/skills/${directory}/SKILL.md`, `---\n${nameField}\ndescription: "${description}"\n---\n# Skill\n`);
  const run = () => {
    const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { root, write, skill, run };
}

test("skill CLI rejects invalid canonical names", async (context) => {
  const cases = [
    ["missing", "apex-example", "", /must be a non-empty string/],
    ["empty", "apex-example", 'name: ""', /must be a non-empty string/],
    ["non-string", "apex-example", "name: [apex-example]", /must be a non-empty string/],
    ["mismatch", "apex-example", "name: apex-other", /does not match directory name/],
    ["unprefixed", "example", "name: example", /exactly one leading apex- prefix/],
    ["double prefix", "apex-apex-example", "name: apex-apex-example", /exactly one leading apex- prefix/],
    ["bare double prefix", "apex-apex", "name: apex-apex", /exactly one leading apex- prefix/],
    ["overlength", `apex-${"a".repeat(60)}`, `name: apex-${"a".repeat(60)}`, /max 64/],
    ["mixed case", "apex-Example", "name: apex-Example", /lowercase kebab-case/],
    ["underscore", "apex_example", "name: apex_example", /lowercase kebab-case/],
    ["empty segment", "apex--example", "name: apex--example", /lowercase kebab-case/],
    ["trailing hyphen", "apex-example-", "name: apex-example-", /lowercase kebab-case/],
  ];
  for (const [label, directory, nameField, expected] of cases) {
    await context.test(label, (child) => {
      const fixture = cliFixture(child);
      fixture.skill(directory, nameField);
      const result = fixture.run();
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, expected);
    });
  }
});

test("skill CLI accepts the exact length boundary and preserves descriptor redirects and public aliases", (context) => {
  const fixture = cliFixture(context);
  const name = `apex-${"a".repeat(59)}`;
  fixture.skill(name, `name: '${name}'`);
  fixture.skill("apex-example");
  fixture.skill(
    "apex-routing",
    "name: apex-routing",
    "DO NOT USE FOR: example (use example), canonical (use apex-example), agent (use worker), pricing (use azure-pricing MCP).",
  );
  fixture.write(".github/agents/worker.agent.md", "---\nname: worker\n---\n# Worker\n");
  let result = fixture.run();
  assert.equal(result.status, 0, result.output);
  fixture.skill("apex-routing", "name: apex-routing", "Unknown redirect (use missing-example).");
  result = fixture.run();
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /references missing skill\/agent "missing-example"/);
  fixture.skill("apex-routing", "name: apex-routing", "a".repeat(501));
  result = fixture.run();
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /max 500/);
});

test("skill CLI accepts every surviving skill and its descriptor without altering source", (context) => {
  const fixture = cliFixture(context);
  cpSync(skillsRoot, path.join(fixture.root, ".github/skills"), { recursive: true });
  cpSync(new URL("../../../.github/agents/", import.meta.url), path.join(fixture.root, ".github/agents"), {
    recursive: true,
  });
  const survivors = readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.ok(survivors.length > 0);
  const result = fixture.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, new RegExp(`Found ${survivors.length} skill directories`));
});

test("skill CLI scans live guidance, tooling and MDX without blanket migration or site exemptions", async (context) => {
  const liveFiles = [
    ".github/agents/example.agent.md",
    ".github/instructions/example.instructions.md",
    ".github/skills/apex-example/references/migration/guide.md",
    ".github/skills/apex-vendor-prompting/references/guide.md",
    "tools/scripts/example.mjs",
    "tools/apex-prompts/example.prompt.md",
    "tools/tests/prompts/example.prompt.md",
    "tools/tests/fixtures-guide.md",
    "tools/schemas-guide.md",
    "site/src/content/docs/guide.mdx",
    "site/src/content/docs/migration/guide.md",
    "AGENTS.md",
    "README.md",
    "CONTRIBUTING.md",
    "CONTRIBUTORS.md",
    "QUALITY_SCORE.md",
  ];
  for (const file of liveFiles) {
    await context.test(file, (child) => {
      const fixture = cliFixture(child);
      fixture.skill("apex-example");
      fixture.write(file, `Use ${retiredName}.\n`);
      let result = fixture.run();
      assert.equal(result.status, 1, result.output);
      assert.ok(result.output.includes(`${file}:1`), result.output);
      assert.match(result.output, /rename to "apex-azure-diagnostics"/);
      fixture.write(file, "Read skills/example/SKILL.md\n");
      result = fixture.run();
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /use skills\/apex-example\/SKILL.md/);
      fixture.write(file, "Read skills/apex-example/SKILL.md\n");
      result = fixture.run();
      assert.equal(result.status, 0, result.output);
    });
  }
});

test("skill CLI excludes history, schemas, vendor snapshots and execution evidence", (context) => {
  const fixture = cliFixture(context);
  fixture.skill("apex-example");
  for (const file of [
    "CHANGELOG.md",
    "VERSION.md",
    "tools/CHANGELOG.md",
    "tools/schemas/example.schema.json",
    ".github/skills/apex-example/PLUGIN_VERSION.md",
    ".github/skills/apex-vendor-prompting/references/.snapshots/upstream.md",
    "tools/tests/exec-plans/active/audit.md",
    "tools/tests/exec-plans/completed/audit.md",
    "tools/tests/fixtures/legacy.md",
    "tools/tests/scripts/fixtures/legacy.md",
    "tools/tests/vendor-prompting/fixtures/legacy.md",
    "tools/tests/scripts/test_legacy.mjs",
    "tools/tests/legacy.test.mjs",
    "tools/apex-recall/tests/test_legacy.py",
    "tools/apex-recall/tmp/evidence.md",
    "tools/node_modules/vendor/README.md",
    "agent-output/example/legacy.md",
    "tmp/evidence.md",
    "logs/copilot/evidence.txt",
    "site/public/downloads/legacy.md",
  ]) {
    fixture.write(file, `${retiredName}\nRead skills/example/SKILL.md\n`);
  }
  const result = fixture.run();
  assert.equal(result.status, 0, result.output);
});

test("skill CLI checks canonical example names without requiring installation", (context) => {
  const fixture = cliFixture(context);
  fixture.skill("apex-example");
  fixture.write("README.md", "Read skills/apex-new-example/SKILL.md\n");
  let result = fixture.run();
  assert.equal(result.status, 0, result.output);
  for (const name of ["new-example", "apex-apex-example", "apex-apex", `apex-${"a".repeat(60)}`]) {
    fixture.write("README.md", `Read skills/${name}/SKILL.md\n`);
    result = fixture.run();
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Non-canonical skill path/);
  }
});

test("skill CLI skips only the quality-score history section, not surrounding live guidance", (context) => {
  const fixture = cliFixture(context);
  fixture.skill("apex-example");
  const history = `## Change Log\nHistorical ${retiredName}: skills/example/SKILL.md\n`;
  fixture.write("QUALITY_SCORE.md", `# Quality Score\n${history}\n## How to Update\nCurrent guidance.\n`);
  let result = fixture.run();
  assert.equal(result.status, 0, result.output);
  fixture.write("QUALITY_SCORE.md", `# Quality Score\n${history}\n## How to Update\nUse ${retiredName}.\n`);
  result = fixture.run();
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /QUALITY_SCORE\.md:6/);
});

test("deploy delegation preserves legacy anchors and requires the complete canonical safety rules", () => {
  const source = read(deployRules);
  assert.ok(source.startsWith("<!-- ref:global-rules-v1 -->"));
  assert.deepEqual(headings(source), [
    "Global Rules",
    "Rule 1: Destructive Actions Require User Confirmation",
    "What is Destructive?",
    "How to Confirm",
    "No Exceptions",
    "Rule 2: Never Assume Subscription or Location",
  ]);
  assert.match(source, /MANDATORY[\s\S]*Before any deployment action, read and apply the entire/);
  assert.match(source, /Do not proceed if that reference cannot be loaded/);
  const canonical = read(linkedReference(deployRules, "canonical Global Rules"));
  for (const category of ["Delete", "Overwrite", "Irreversible", "Cost Impact", "Security"]) {
    assert.ok(canonical.includes(`**${category}**`), `Lost safety category: ${category}`);
  }
  assert.match(canonical, /ALWAYS use `ask_user`\*\* before ANY destructive action/);
  assert.match(canonical, /Do NOT assume user wants to delete\/overwrite/);
  assert.match(canonical, /Do NOT proceed based on "the user asked to deploy"/);
  assert.match(canonical, /Do NOT batch destructive actions without individual confirmation/);
  assert.match(canonical, /ask_user\([\s\S]*choices: \["Yes, delete it", "No, cancel"\]/);
  assert.match(canonical, /Azure subscription \(show actual name and ID\)/);
  assert.match(canonical, /Azure region\/location/);
  assert.match(read(new URL("../SKILL.md", deployRules)), /\[global-rules\]\(references\/global-rules.md\)/);
});

test("deploy delegation preserves A09 confirmed context and the local readiness checklist", () => {
  const source = read(deployRules);
  assert.match(source, /mandatory \[confirmation reuse\]/);
  assert.match(
    source,
    /read and apply that section; reuse unchanged confirmed context for the same project\/environment/,
  );
  assert.match(source, /re-ask when missing or invalidated/);
  assert.match(
    source,
    /Reuse does not waive current readiness checks,\s+deployment approval, or individual destructive-action confirmation/,
  );
  const confirmation = linkedReference(deployRules, "confirmation reuse");
  assert.equal(confirmation.hash, "#confirmation-reuse");
  const reuse = section(confirmation, "Confirmation reuse");
  assert.match(reuse, /Reuse unchanged user-confirmed subscription and region without asking again/);
  assert.match(reuse, /apex-recall show <project> --json/);
  assert.match(reuse, /changed project\/environment\s+or subscription\/tenant\/region/);
  assert.match(reuse, /access, policy, service availability, or capacity/);
  assert.match(reuse, /After compaction or a new chat, recover persisted confirmation before asking/);
  assert.match(
    reuse,
    /Still perform required current\s+permission, policy, availability, capacity, and resource-group compatibility/,
  );
  assert.match(reuse, /does not authorize\s+deployment, destructive operations, or bypass plan approval/);
  const checklist = linkedReference(deployRules, "Pre-Deploy Checklist");
  assert.equal(checklist.href, new URL("pre-deploy-checklist.md", deployRules).href);
  assert.match(source, /Complete the local/);
  assert.match(read(checklist), /Apply \[confirmation reuse\]/);
  assert.match(read(checklist), /MUST complete this checklist IN ORDER/);
});

test("cost orphan discovery loads only named canonical patterns with exact KQL fields", () => {
  const source = read(costQueries);
  assert.match(source, /Before orphan discovery, you MUST read only these named patterns/);
  assert.match(source, /Use their exact KQL, including projected fields/);
  assert.match(source, /Do not proceed if the patterns cannot be loaded/);
  assert.match(source, /Do not invoke the `apex-azure-resources` skill or run its inventory workflow; return here/);
  const target = linkedReference(costQueries, "Orphaned Resource Patterns");
  assert.equal(target.hash, "#orphaned-resource-patterns");
  const patterns = section(target, "Orphaned Resource Patterns");
  const expected = [
    [
      "Unattached managed disks",
      "Resources\n| where type =~ 'microsoft.compute/disks'\n| where isempty(managedBy)\n| project name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name\n",
    ],
    [
      "Unused public IP addresses",
      "Resources\n| where type =~ 'microsoft.network/publicipaddresses'\n| where isempty(properties.ipConfiguration)\n| project name, resourceGroup, location, sku=sku.name\n",
    ],
    [
      "Orphaned network interfaces",
      "Resources\n| where type =~ 'microsoft.network/networkinterfaces'\n| where isempty(properties.virtualMachine)\n| project name, resourceGroup, location\n",
    ],
  ];
  for (const [label, query] of expected) {
    assert.ok(source.includes(`- **${label}**`), `Missing targeted read: ${label}`);
    const pattern = patterns.split(`**${label}:**`)[1];
    assert.ok(pattern, `Missing canonical pattern: ${label}`);
    assert.equal(kqlBlocks(pattern)[0], query, label);
    assert.ok(!kqlBlocks(source).includes(query), `Duplicate query remains: ${label}`);
  }
});

test("cost-specific queries and cost evidence/report obligations survive sharing", () => {
  const source = read(costQueries);
  assert.deepEqual(kqlBlocks(source), [
    "Resources\n| where isnotempty(sku.name)\n| summarize count() by type, tostring(sku.name)\n| order by count_ desc\n",
    "Resources\n| extend hasCostCenter = isnotnull(tags['CostCenter'])\n| summarize total=count(), tagged=countif(hasCostCenter) by type\n| extend coverage=round(100.0 * tagged / total, 1)\n| order by total desc\n",
    "Resources\n| where type =~ 'microsoft.network/loadbalancers'\n| where array_length(properties.backendAddressPools) == 0\n| project name, resourceGroup, location, sku=sku.name\n",
    "AdvisorResources\n| where properties.category == 'Cost'\n| project name, impact=properties.impact, description=properties.shortDescription.solution\n",
  ]);
  assert.match(
    source,
    /Discovery alone is not savings evidence: correlate findings with actual Cost Management data and utilization metrics/,
  );
  assert.match(source, /Cross-reference orphaned resources with cost data from Cost Management API/);
  const entry = read(new URL("../SKILL.md", costQueries));
  assert.match(entry, /\[.*azure-resource-graph.md.*\]\(\.\/references\/azure-resource-graph.md\)/);
  assert.match(entry, /recommendations must be grounded in actual cost queries and utilization metrics/);
  assert.match(entry, /every savings estimate must reference the underlying cost query or pricing API result/);
  assert.match(entry, /Read-only analysis first/);
  assert.match(entry, /never auto-apply destructive operations/);
  const workflow = linkedReference(costQueries, "cost, pricing, metrics, report, and audit procedure");
  assert.equal(workflow.hash, "#step-4-query-actual-costs");
  const costQuery = section(workflow, "Step 4: Query Actual Costs");
  const query = JSON.parse(costQuery.match(/```json\n([\s\S]*?)```/)[1]);
  assert.equal(query.type, "ActualCost");
  assert.deepEqual(query.dataset.grouping, [{ type: "Dimension", name: "ResourceId" }]);
  assert.match(section(workflow, "Step 6: Collect Utilization Metrics"), /Query Azure Monitor for utilization data/);
  assert.match(section(workflow, "Step 7: Generate Optimization Report"), /output\/costoptimizereport/);
  assert.match(section(workflow, "Step 8: Save Audit Trail"), /output\/cost-query-result/);
});

test("shared procedure relative links and section anchors resolve locally", () => {
  for (const file of [deployRules, costQueries]) {
    for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
      assert.doesNotMatch(match[1], /^(?:[a-z]+:|\/)/, "Procedure links must stay relative");
      const target = new URL(match[1], file);
      const source = read(target);
      if (target.hash) {
        assert.ok(headings(source).map(slug).includes(target.hash.slice(1)), `Missing anchor: ${target.href}`);
      }
    }
  }
});
