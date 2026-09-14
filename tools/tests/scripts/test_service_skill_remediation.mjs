import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const linkCheckRequire = createRequire(import.meta.resolve("markdown-link-check"));
const extractorRequire = createRequire(linkCheckRequire.resolve("markdown-link-extractor"));
const { marked } = await import(extractorRequire.resolve("marked"));

const skillsRoot = new URL("../../../.github/skills/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, skillsRoot), "utf8");
const blocks = (source) => [...source.matchAll(/```kql\n([\s\S]*?)```/g)].map((match) => match[1]);
const ownedSkills = ["resources", "diagnostics", "quotas", "kusto", "storage", "compute"].map(
  (service) => `apex-azure-${service}`,
);

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith(".md") ? [file] : [];
  });
}

function anchors(source) {
  const result = new Set();
  const duplicates = new Map();
  marked.walkTokens(marked.lexer(source), (token) => {
    if (token.type !== "heading") return;
    const base = token.text
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "")
      .replaceAll(" ", "-");
    const count = duplicates.get(base) ?? 0;
    result.add(count ? `${base}-${count}` : base);
    duplicates.set(base, count + 1);
  });
  for (const match of source.matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
  return result;
}

test("SK-35 SK-38 all owned service links, anchors and reference-index paths resolve locally", () => {
  const failures = [];
  for (const skill of ownedSkills) {
    for (const file of markdownFiles(new URL(`${skill}/`, skillsRoot))) {
      const source = readFileSync(file, "utf8");
      marked.walkTokens(marked.lexer(source), (token) => {
        const target =
          token.type === "link" || token.type === "image"
            ? token.href
            : token.type === "codespan" && /^(?:references|assets|\.\.)\/.+\.md(?:#.*)?$/.test(token.text)
              ? token.text
              : undefined;
        if (!target || /^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) return;
        const resolved = new URL(target, file);
        const hash = decodeURIComponent(resolved.hash.slice(1));
        resolved.hash = "";
        if (!existsSync(resolved)) failures.push(`${file.pathname}: missing ${target}`);
        else if (hash && resolved.pathname.endsWith(".md") && !anchors(readFileSync(resolved, "utf8")).has(hash))
          failures.push(`${file.pathname}: missing anchor ${target}`);
      });
    }
  }
  assert.deepEqual(failures, []);
});

test("SK-20 orphan projections preserve identity for ResourceId cost correlation", () => {
  const source = read("apex-azure-resources/references/azure-resource-graph.md");
  const orphanQueries = blocks(source.split("## Orphaned Resource Patterns")[1].split("\n## ")[0]);
  assert.equal(orphanQueries.length, 4);
  const resources = [
    {
      id: "/subscriptions/one/resourceGroups/alpha/providers/example/disks/shared",
      subscriptionId: "one",
      name: "shared",
      resourceGroup: "alpha",
    },
    {
      id: "/subscriptions/one/resourceGroups/beta/providers/example/disks/shared",
      subscriptionId: "one",
      name: "shared",
      resourceGroup: "beta",
    },
    {
      id: "/subscriptions/two/resourceGroups/alpha/providers/example/disks/shared",
      subscriptionId: "two",
      name: "shared",
      resourceGroup: "alpha",
    },
  ];
  const costs = resources.map((resource, index) => ({ ResourceId: resource.id.toUpperCase(), cost: index + 1 }));
  for (const query of orphanQueries) {
    const columns = query
      .match(/\| project (.+)/)[1]
      .split(",")
      .map((column) => column.trim().split("=")[0]);
    assert.ok(columns.includes("id"));
    assert.ok(columns.includes("subscriptionId"));
    const projected = resources.map((resource) =>
      Object.fromEntries(columns.map((column) => [column, resource[column]])),
    );
    const correlated = projected.map((resource) =>
      costs.filter((cost) => cost.ResourceId.toLowerCase() === resource.id.toLowerCase()),
    );
    assert.deepEqual(
      correlated.map((matches) => matches.map((match) => match.cost)),
      [[1], [2], [3]],
    );
  }
  assert.match(source, /Cost Management `ResourceId` with `id` case-insensitively/);
});

test("SK-20 resource tag examples use applicable policy keys and treat empty values as missing", () => {
  const source = read("apex-azure-resources/references/azure-resource-graph.md");
  const queries = blocks(source.split("## Tag & Compliance Patterns")[1].split("\n## ")[0]);
  assert.match(queries[0], /isempty\(tags\['<required-tag-key>'\]\)/);
  assert.match(queries[1], /isnotempty\(tags\['<required-tag-key>'\]\)/);
  assert.doesNotMatch(queries.join("\n"), /tags\['(?:Environment|CostCenter)'\]/);
  assert.match(source, /Resource-group tag[\s\S]*`ResourceContainers`/);
});

test("SK-27 telemetry uses configured identity, not resource-group proximity", () => {
  const source = read("apex-azure-diagnostics/references/functions/README.md");
  assert.match(source, /properties.InstrumentationKey\) =~ '<configured-instrumentation-key>'/);
  assert.doesNotMatch(source, /on rg|\| \[0\]|_ResourceId contains/);
  assert.match(source, /Require exactly one match/);
  assert.match(source, /customerId/);
  const components = [
    { id: "other-group/correct", resourceGroup: "other-group", key: "KEY" },
    { id: "function-group/wrong", resourceGroup: "function-group", key: "wrong" },
    { id: "function-group/also-wrong", resourceGroup: "function-group", key: "another" },
  ];
  const resolve = (key, inventory) => {
    const matches = inventory.filter((component) => component.key.toLowerCase() === key.toLowerCase());
    return matches.length === 1 ? matches[0].id : undefined;
  };
  assert.equal(resolve("key", components), "other-group/correct");
  assert.equal(resolve("missing", components), undefined);
  assert.equal(resolve("key", [...components, { id: "duplicate", key: "key" }]), undefined);
  assert.match(source, /traces \| where timestamp > ago\(1h\)/);
  assert.match(source, /FunctionAppLogs \| where TimeGenerated > ago\(1h\)/);
});

test("SK-27 capacity uses numeric metric samples and playbooks define severity and approval", () => {
  const health = read("apex-azure-diagnostics/references/infraops-health-checks.md");
  assert.match(health, /--metric UsedCapacity --aggregation Average/);
  assert.doesNotMatch(health, /primaryEndpoints/);
  assert.match(health, /Missing, null, nonnumeric or stale samples are\s+unknown, not zero/);
  const playbook = read("apex-azure-diagnostics/references/infraops-remediation-playbooks.md");
  assert.doesNotMatch(playbook, /references\/(?:health-checks|kql-templates)\.md|severity table in SKILL/);
  for (const severity of ["Critical", "High", "Medium", "Low"]) assert.ok(playbook.includes(`| ${severity} |`));
  assert.match(playbook, /Obtain separate approval/);
});

test("SK-28 documented quota helper rejects invalid evidence and never establishes capacity", () => {
  const source = read("apex-azure-quotas/references/commands.md");
  const helper = source.split("### Checked Headroom")[1].match(/```bash\n([\s\S]*?)```/)[1];
  const scope = "/subscriptions/12345678-1234-1234-1234-123456789abc/providers/Microsoft.Compute/locations/eastus";
  const run = (...args) =>
    spawnSync("bash", ["-c", `${helper}\nquota_headroom "$@"`, "quota-test", ...args], { encoding: "utf8" });
  for (const [limit, usage, need, status] of [
    ["350", "50", "12", 0],
    ["12", "8", "4", 0],
    ["12", "8", "5", 1],
    ["08", "01", "02", 0],
  ]) {
    const result = run(scope, limit, usage, need);
    assert.equal(result.status, status, result.stderr);
    assert.match(result.stdout, /regional capacity: unknown/);
  }
  for (const value of [
    "",
    "null",
    "No Limit",
    "Unlimited",
    "https://endpoint",
    "-1",
    "1.5",
    "1+2",
    "99999999999999999999",
  ]) {
    for (const field of [0, 1, 2]) {
      const values = ["350", "50", "12"];
      values[field] = value;
      assert.equal(run(scope, ...values).status, 2, `${field}: ${value}`);
    }
  }
  assert.equal(run("/subscriptions/wrong/locations/eastus", "350", "50", "12").status, 2);
  assert.match(source, /`BadRequest` alone does not prove an unsupported provider/);
  assert.match(source, /az vm list-usage --subscription <subscription-id> --location <region>/);
  for (const relative of [
    "SKILL.md",
    "references/core-workflows.md",
    "references/troubleshooting.md",
    "references/resource-name-mapping.md",
  ]) {
    const consumer = read(`apex-azure-quotas/${relative}`);
    assert.match(consumer, /commands\.md#quota-evidence-and-fallback/);
    assert.doesNotMatch(
      consumer,
      /Quotas = available capacity|Confirmed working providers|never to REST API or Portal/,
    );
  }
});

test("SK-31 Kusto examples bound scans, both join inputs and output", () => {
  const queries = blocks(read("apex-azure-kusto/references/query-patterns.md"));
  for (const query of queries) {
    assert.match(query, /\| where Timestamp between \(/);
    assert.match(query, /\| take \d+/);
    assert.ok(
      query.indexOf("| where Timestamp") <
        (query.indexOf("| summarize") === -1 ? query.length : query.indexOf("| summarize")),
    );
  }
  const join = queries.find((query) => query.includes("| join"));
  assert.equal([...join.matchAll(/Timestamp between \(windowStart \.\. windowEnd\)/g)].length, 2);
  assert.ok(join.indexOf("| take") > join.indexOf(") on CorrelationId"));
  const windowEnd = Date.UTC(2026, 8, 14, 12);
  const windowStart = windowEnd - 60 * 60 * 1000;
  const rows = [windowStart - 1, windowStart, windowEnd, windowEnd + 1].map((Timestamp) => ({
    Timestamp,
    CorrelationId: "reused",
  }));
  const bounded = rows.filter((row) => row.Timestamp >= windowStart && row.Timestamp <= windowEnd);
  const matches = bounded.flatMap((event) => bounded.filter((log) => log.CorrelationId === event.CorrelationId));
  assert.equal(matches.length, 4);
  assert.ok(matches.every((row) => row.Timestamp >= windowStart && row.Timestamp <= windowEnd));
  const cap = Number(join.match(/\| take (\d+)/)[1]);
  assert.equal(Array.from({ length: cap + 1 }).slice(0, cap).length, cap);
});

test("SK-37 Rust overview delegates to one leaf and preserves an explicit SDK verification gap", () => {
  const overview = read("apex-azure-storage/references/sdk-usage.md");
  const leaf = read("apex-azure-storage/references/sdk/azure-storage-blob-rust.md");
  assert.doesNotMatch(overview, /```rust|upload\(None, data/);
  assert.match(overview, /sdk\/azure-storage-blob-rust.md#version-gate/);
  assert.match(leaf, /\.upload\(RequestContent::from\(data.to_vec\(\)\), false, content_length, None\)/);
  assert.match(leaf, /u64::try_from\(data.len\(\)\)/);
  assert.match(leaf, /exact `azure_storage_blob`, `azure_identity` and\s+`azure_core` versions/);
  assert.match(leaf, /cargo check --locked --offline/);
  assert.match(leaf, /SDK compatibility remains unverified/);
});

test("SK-35 service source catalogs preserve on-demand procedures without duplicate indexes", () => {
  const diagnostics = read("apex-azure-diagnostics/SKILL.md");
  assert.match(diagnostics, /infraops-remediation-playbooks.md#diagnostic-workflow-six-phases/);
  for (const name of ["apex-azure-diagnostics", "apex-azure-compute"]) {
    const headings = [...read(`${name}/SKILL.md`).matchAll(/^## Reference Index\s*$/gm)];
    assert.equal(headings.length, 1, `${name}: retain one freshness-compatible reference index`);
  }
  assert.match(read("apex-azure-resources/SKILL.md"), /references\/lookup-workflow.md/);
  assert.match(
    read("apex-azure-quotas/references/troubleshooting.md"),
    /not\s+treat a static provider catalog as proof of support/,
  );
});

test("SK-35 every owned service reference is reachable from its entry point", () => {
  for (const skill of ownedSkills) {
    const root = new URL(`${skill}/`, skillsRoot);
    const pending = [new URL("SKILL.md", root)];
    const visited = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (visited.has(file.href)) continue;
      visited.add(file.href);
      marked.walkTokens(marked.lexer(readFileSync(file, "utf8")), (token) => {
        const target = token.type === "link" ? token.href : token.type === "codespan" ? token.text : "";
        if (!/\.md(?:#.*)?$/.test(target) || /^[a-z][a-z\d+.-]*:/i.test(target)) return;
        const resolved = new URL(target, file);
        resolved.hash = "";
        if (resolved.href.startsWith(root.href) && existsSync(resolved)) pending.push(resolved);
      });
    }
    const unreachable = markdownFiles(root).filter((file) => !visited.has(file.href));
    assert.deepEqual(
      unreachable.map((file) => file.pathname),
      [],
      skill,
    );
  }
});
