import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  exportWafReviewCsv,
  isKnownAnswer,
  parseCsv,
  sanitizeSpreadsheetText,
} from "../../scripts/export-waf-review-csv.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("exportWafReviewCsv populates exact Selected Answer values, preserves unknowns, and neutralizes formulas", (t) => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".apex-waf-csv-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const project = path.join(dir, "demo-assessment");
  fs.mkdirSync(path.join(project, "_meta"), { recursive: true });
  fs.mkdirSync(path.join(project, "contracts"), { recursive: true });

  fs.writeFileSync(
    path.join(project, "_meta/controls-evidence.json"),
    JSON.stringify({
      configuration: [
        {
          scope: "/subscriptions/00000000-0000-0000-0000-000000000001",
          items: [
            {
              id: "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/rg/providers/Microsoft.KeyVault/vaults/kv1",
              type: "Microsoft.KeyVault/vaults",
              kvRbac: true,
              httpsOnly: true,
              minTlsVersion: "1.2",
              publicNetworkAccess: "Disabled",
            },
          ],
        },
      ],
      topology: [
        {
          private_endpoint_connections: [{ connectionStatus: "Approved" }],
          items: [{ type: "Microsoft.Network/networkSecurityGroups" }],
        },
      ],
    }),
  );

  fs.writeFileSync(
    path.join(project, "_meta/waf-checks.json"),
    JSON.stringify({
      project: "demo-assessment",
      as_of: "2026-11-26T12:00:00.000Z",
      checks: [
        {
          id: "C01",
          pillar: "Security",
          state: "passed",
          check: "Vault RBAC",
          evidence: "_meta/controls-evidence.json",
        },
        {
          id: "C02",
          pillar: "Security",
          state: "risk",
          check: "=CMD|' /C calc'!A0",
          evidence: "_meta/controls-evidence.json",
          notes: "+InjectedNote",
        },
      ],
    }),
  );

  const customTemplate = [
    "Azure Well-Architected Review - Template Export,,,,,",
    "Category,Link-Text,Link,Priority,ReportingCategory,ReportingSubcategory,Weight,Context,CompleteY/N,Note",
    "-----------,,,,,",
    "Category,Question,Answers,Selected Answer,Note",
    'Security,"How do you classify your workload data and ensure it is protected according to its sensitivity?\n",We have aligned the classification categories for our data to our business requirements.,,,',
    'Security,"How do you classify your workload data and ensure it is protected according to its sensitivity?\n",None of the above.,,,',
    "Security,How is network connectivity secured for this workload?,Connectivity to PaaS services uses private endpoints.,,,",
    "Security,How is network connectivity secured for this workload?,None of the above.,,,",
    "Reliability,How do you test your resiliency and availability strategies?,We run tests in a production-like environment, and we run a targeted subset of tests in production.,,,",
    "Reliability,How do you test your resiliency and availability strategies?,None of the above.,,,",
    "Performance Efficiency,How do you conduct capacity planning?,We gather capacity data to forecast future demand.,,,",
    "Performance Efficiency,How do you conduct capacity planning?,None of the above.,,,",
  ].join("\r\n");

  const templatePath = path.join(dir, "template.csv");
  fs.writeFileSync(templatePath, customTemplate, "utf8");

  const answers = {
    security_sdlc_practices: "Threat modeling, data classification, and automated pipeline security scans",
    dr_testing_cadence: "No formal recovery or resilience testing",
    performance_testing_practices: "Unknown — assess with available evidence",
  };

  const { csv, stats } = exportWafReviewCsv({ projectDir: project, templatePath, answers });
  assert.equal(stats.total_questions, 4);
  assert.equal(stats.answered_questions, 3);
  assert.equal(stats.unknown_questions, 1);

  const rows = parseCsv(csv);
  // Formula neutralization on risk recommendation Link-Text and Note
  const recRow = rows.find((r) => r[0] === "Security" && r[1].includes("C02 -"));
  assert.ok(recRow);
  assert.equal(sanitizeSpreadsheetText("=CMD"), "'=CMD");
  assert.ok(recRow[9].includes("[APEX _meta/waf-checks.json#sha256="));

  // WARP convention: Selected Answer repeats exact Answers text
  const peRow = rows.find((r) => r[2] === "Connectivity to PaaS services uses private endpoints.");
  assert.equal(peRow[3], "Connectivity to PaaS services uses private endpoints.");
  assert.match(peRow[4], /\[Observed: _meta\/controls-evidence\.json#sha256=/);

  // Multiline question matched cleanly from human-attested practice
  const classRow = rows.find(
    (r) => r[2] === "We have aligned the classification categories for our data to our business requirements.",
  );
  assert.equal(classRow[3], classRow[2]);
  assert.match(classRow[4], /\[Human-attested: security_sdlc_practices=/);

  // Explicit negative attestation selects None of the above
  const drNoneRow = rows.find((r) => r[1].includes("test your resiliency") && r[2] === "None of the above.");
  assert.equal(drNoneRow[3], "None of the above.");

  // Unknown question NEVER fabricates None of the above!
  const capNoneRow = rows.find((r) => r[1].includes("conduct capacity planning") && r[2] === "None of the above.");
  assert.equal(capNoneRow[3], "");
  const capFirstRow = rows.find(
    (r) => r[1].includes("conduct capacity planning") && r[2].includes("gather capacity data"),
  );
  assert.match(capFirstRow[4], /Unknown \/ Not assessed/);

  // CLI standalone built-in template mode
  const outCsv = path.join(dir, "built-in-export.csv");
  const cli = spawnSync(
    process.execPath,
    [path.join(root, "tools/scripts/export-waf-review-csv.mjs"), "--project-dir", project, "--out", outCsv],
    { encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.ok(fs.existsSync(outCsv));
  assert.ok(JSON.parse(cli.stdout).selected_options >= 4);

  // BOM stripping, unclosed quote rejection, and tab formula sanitization
  assert.deepEqual(parseCsv("\uFEFFa,b\r\n1,2")[0], ["a", "b"]);
  assert.throws(() => parseCsv('a,"unclosed'), /unclosed quoted field/);
  assert.equal(sanitizeSpreadsheetText("\t=1+1"), "'\t=1+1");
});

test("exportWafReviewCsv handles integer 1/0 ARG booleans, legacy WARP aliases, and prose-unknown answers", (t) => {
  // Prose unknown rejection vs mixed clause preservation
  assert.equal(isKnownAnswer("Formal availability SLA percentage: unknown."), false);
  assert.equal(isKnownAnswer("Latency and throughput targets are unknown."), false);
  assert.equal(isKnownAnswer("Monthly budget cap is unknown; no monthly planning amount was supplied."), false);
  assert.equal(isKnownAnswer("Cutover RTO under one hour with documented rollback. RPO is unknown."), true);

  const legacyWarpTemplate = [
    "Azure Well-Architected Review - Sample,,,,,",
    "Category,Link-Text,Link,Priority,ReportingCategory,ReportingSubcategory,Weight,Context,CompleteY/N,Note",
    "-----------,,,,,",
    "Category,Question,Answers,Selected Answer,Note",
    "Security,How do you secure connectivity for this workload?,We've secured connectivity to platform as a service (PaaS) endpoints.,,,",
    "Security,How do you secure connectivity for this workload?,We restrict public IP addresses from accessing individual services, and we protect them with service-level firewall rules.,,,",
    "Security,How do you secure connectivity for this workload?,None of the above.,,,",
    "Reliability,How do you define reliability targets?,We have availability targets.,,,",
    "Reliability,How do you define reliability targets?,We have recovery targets.,,,",
    "Reliability,How do you define reliability targets?,None of the above.,,,",
    "Cost Optimization,How do you perform cost modeling?,We determine cost drivers.,,,",
    "Cost Optimization,How do you perform cost modeling?,We have a budget for the workload.,,,",
    "Cost Optimization,How do you perform cost modeling?,None of the above.,,,",
  ].join("\r\n");

  const dir = fs.mkdtempSync(path.join(process.cwd(), ".apex-factory-csv-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const tpl = path.join(dir, "warp-2023.csv");
  fs.writeFileSync(tpl, legacyWarpTemplate, "utf8");

  // Self-contained integer 1/0 + legacy wrapper fixture (runs in both upstream apex and apex-mine)
  const synthDir = path.join(dir, "synth-bundle");
  fs.mkdirSync(path.join(synthDir, "_meta/inputs"), { recursive: true });
  fs.mkdirSync(path.join(synthDir, "contracts"), { recursive: true });
  fs.writeFileSync(
    path.join(synthDir, "_meta/controls-evidence.json"),
    JSON.stringify({
      configuration: [
        {
          scope: "/subscriptions/00000000-0000-0000-0000-000000000001",
          items: [
            {
              id: "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/rg/providers/Microsoft.Web/sites/app1",
              type: "microsoft.web/sites",
              httpsOnly: 1,
              publicNetworkAccess: "Enabled",
            },
            {
              id: "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/rg/providers/Microsoft.KeyVault/vaults/kv1",
              type: "microsoft.keyvault/vaults",
              kvRbac: 1,
              publicNetworkAccess: "Disabled",
            },
          ],
        },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(synthDir, "_meta/scalar-topology.json"),
    JSON.stringify({
      subscriptions: [
        {
          scope: "/subscriptions/00000000-0000-0000-0000-000000000001",
          result: [{ items: [{ connectionState: "Approved" }] }],
        },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(synthDir, "contracts/03-cost-management.json"),
    JSON.stringify({ evidence: [{ status: "complete" }] }),
  );
  fs.writeFileSync(
    path.join(synthDir, "_meta/waf-checks.json"),
    JSON.stringify({
      project: "synth-bundle",
      as_of: "2026-11-26T12:00:00.000Z",
      checks: [
        { id: "S1", pillar: "Security", state: "passed", check: "HTTPS", evidence: "_meta/controls-evidence.json" },
        { id: "S2", pillar: "Security", state: "passed", check: "RBAC", evidence: "_meta/controls-evidence.json" },
        {
          id: "C1",
          pillar: "Cost Optimization",
          state: "risk",
          check: "Single risk",
          evidence: "contracts/03-cost-management.json",
        },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(synthDir, "_meta/inputs/requirements-led-answers.json"),
    JSON.stringify({
      availability_target: "Formal availability SLA percentage: unknown.",
      recovery_profile: "Cutover RTO under one hour with documented rollback. RPO is unknown.",
      monthly_budget_amount: "Monthly budget cap is unknown; no monthly planning amount was supplied.",
    }),
  );

  const checkBundle = (bundlePath, expectedScoreRatio) => {
    const { csv } = exportWafReviewCsv({ projectDir: bundlePath, templatePath: tpl });
    const rows = parseCsv(csv);
    const headerSlice = rows.slice(0, 12);
    assert.ok(headerSlice.some((r) => r[0] === "Security" && r[1] === "Excellent" && r[2] === expectedScoreRatio));
    assert.ok(!headerSlice.some((r) => r[0] === "Cost Optimization" && r[1] === "Not Assessed"));
    const peRow = rows.find((r) => r[2] === "We've secured connectivity to platform as a service (PaaS) endpoints.");
    assert.equal(peRow[3], peRow[2]);
    const noPubRow = rows.find((r) => r[2].startsWith("We restrict public IP addresses"));
    assert.equal(noPubRow[3], "");
    assert.equal(rows.find((r) => r[2] === "We have availability targets.")[3], "");
    assert.equal(rows.find((r) => r[2] === "We have recovery targets.")[3], "We have recovery targets.");
    assert.equal(rows.find((r) => r[2] === "We determine cost drivers.")[3], "We determine cost drivers.");
    assert.equal(rows.find((r) => r[2] === "We have a budget for the workload.")[3], "");
  };

  checkBundle(synthDir, "'100/100");
  const factoryDir = path.join(root, "agent-output/partner-modernization-factory-v2");
  if (fs.existsSync(factoryDir)) {
    checkBundle(factoryDir, "'73/100");
  }
});
