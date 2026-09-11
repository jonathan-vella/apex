import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const skillsRoot = new URL("../../../.github/skills/", import.meta.url);
const deployRules = new URL("azure-deploy/references/global-rules.md", skillsRoot);
const costQueries = new URL("azure-cost-optimization/references/azure-resource-graph.md", skillsRoot);
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
  assert.match(source, /Do not invoke the `azure-resources` skill or run its inventory workflow; return here/);
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
