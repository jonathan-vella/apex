// SKU Manifest validator fixture test.
//
// Runs tools/scripts/validate-sku-manifest.mjs against the fixtures under
// tools/tests/fixtures/sku-manifest/{valid,invalid}/ and asserts the
// expected pass/fail behaviour. The validator runs in hard-fail mode:
// valid fixtures must exit 0 with no error lines, invalid fixtures must
// exit non-zero with at least one ❌ error line.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderManifest } from "../scripts/render-sku-manifest-md.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATOR = path.join(ROOT, "tools/scripts/validate-sku-manifest.mjs");
const FIXTURE_BASE = path.join(ROOT, "tools/tests/fixtures/sku-manifest");

function runValidator(fixturePath) {
  const result = spawnSync("node", [VALIDATOR, fixturePath], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  return {
    stdout: (result.stdout ?? "") + (result.stderr ?? ""),
    exitCode: result.status ?? 0,
  };
}

function listFixtures(subdir) {
  const dir = path.join(FIXTURE_BASE, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

describe("SKU Manifest validator — valid fixtures", () => {
  for (const fixture of listFixtures("valid")) {
    const name = path.basename(fixture);
    it(`accepts ${name}`, () => {
      const { stdout, exitCode } = runValidator(fixture);
      assert.equal(exitCode, 0, `validator exit=${exitCode} for ${name}:\n${stdout}`);
      const errLines = stdout.split("\n").filter((l) => l.includes("❌"));
      assert.equal(errLines.length, 0, `unexpected errors:\n${errLines.join("\n")}`);
    });
  }
});

describe("SKU Manifest validator — invalid fixtures", () => {
  for (const fixture of listFixtures("invalid")) {
    const name = path.basename(fixture);
    it(`rejects ${name} with non-zero exit`, () => {
      const { stdout, exitCode } = runValidator(fixture);
      assert.notEqual(exitCode, 0, `expected non-zero exit for ${name}, got 0:\n${stdout}`);
      const errLines = stdout.split("\n").filter((l) => l.includes("❌"));
      assert.ok(errLines.length > 0, `expected ❌ error lines for ${name}, got:\n${stdout}`);
    });
  }
});

function existingWorkloadManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_BASE, "valid/multi-stamp.json"), "utf8"));
  manifest.subscriptions = [
    {
      id: "hub",
      display_name: "Shared display",
      subscription_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      role: "hub",
    },
    { id: "spoke", display_name: "Shared display", role: "spoke" },
  ];
  Object.assign(manifest.services[0], {
    source: "observed-current",
    source_step: "1",
    observed_sku: "GP_S_Gen5_2",
  });
  manifest.stamps[0].subscription = "hub";
  manifest.stamps[1].subscription = "spoke";
  return manifest;
}

function validateManifest(manifest, context) {
  const dir = fs.mkdtempSync(path.join(ROOT, "tools/tests/.sku-manifest-"));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "sku-manifest.json");
  fs.writeFileSync(file, JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, "sku-manifest.md"), renderManifest(manifest));
  return runValidator(file);
}

function intakePinManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_BASE, "valid/multi-stamp.json"), "utf8"));
  manifest.environments = ["dev"];
  manifest.revisions[0].agent = "02-Requirements";
  manifest.revisions[0].step = "1";
  manifest.revisions[0].changed_ids = ["storage-pin"];
  manifest.services = [
    {
      id: "storage-pin",
      service: "Storage Account",
      size: "LRS",
      source: "user-pin",
      source_step: "1",
      last_modified_rev: 1,
    },
  ];
  delete manifest.stamps;
  return manifest;
}

describe("SKU Manifest Step 1 partial user pins", () => {
  it("accepts a replication-only pin without inventing configuration", (context) => {
    const manifest = intakePinManifest();
    const before = structuredClone(manifest);
    const { exitCode, stdout } = validateManifest(manifest, context);
    assert.equal(exitCode, 0, stdout);
    const rendered = renderManifest(manifest);
    const row = rendered.split("\n").find((line) => line.startsWith("| `storage-pin`"));
    assert.match(row, /`LRS`/);
    assert.match(row, /Unknown \| Unknown/);
    assert.match(row, /Unknown \| `user-pin`/);
    assert.doesNotMatch(rendered, /Standard_LRS|on-demand/);
    assert.deepEqual(manifest, before);
  });

  it("validates supplied configuration instead of treating it as unknown", (context) => {
    const manifest = intakePinManifest();
    manifest.services[0].capacity = { mode: "fixed" };
    const { exitCode, stdout } = validateManifest(manifest, context);
    assert.notEqual(exitCode, 0, stdout);
    assert.match(stdout, /default/);
  });

  for (const step of ["2", "3.5", "4", "6", "7"]) {
    it(`requires complete user-pin configuration at Step ${step}, even at rev 1`, (context) => {
      const manifest = intakePinManifest();
      manifest.revisions[0].step = step;
      const { exitCode, stdout } = validateManifest(manifest, context);
      assert.notEqual(exitCode, 0, stdout);
      for (const field of ["iac_logical_names", "capacity", "zonal", "regions", "sla_target", "commitment"]) {
        assert.match(stdout, new RegExp(field));
      }
    });
  }

  it("requires complete user-pin configuration after the intake revision", (context) => {
    const manifest = intakePinManifest();
    manifest.current_revision = 2;
    manifest.revisions.push({ ...manifest.revisions[0], rev: 2 });
    const { exitCode, stdout } = validateManifest(manifest, context);
    assert.notEqual(exitCode, 0, stdout);
    assert.match(stdout, /iac_logical_names/);
  });

  it("accepts later configuration while preserving the original lock and creation step", (context) => {
    const manifest = intakePinManifest();
    manifest.current_revision = 2;
    manifest.revisions.push({ ...manifest.revisions[0], rev: 2, agent: "03-Architect", step: "2" });
    Object.assign(manifest.services[0], {
      iac_logical_names: { bicep: "storageData", terraform: "module.storage_data" },
      capacity: { mode: "fixed", default: 1 },
      zonal: false,
      regions: ["swedencentral"],
      sla_target: "Dev/test; no numeric SLA",
      commitment: { type: "on-demand" },
      last_modified_rev: 2,
    });
    const { exitCode, stdout } = validateManifest(manifest, context);
    assert.equal(exitCode, 0, stdout);
    assert.equal(manifest.services[0].size, "LRS");
    assert.equal(manifest.services[0].source, "user-pin");
    assert.equal(manifest.services[0].source_step, "1");
  });

  for (const [source, sourceStep] of [
    ["architect-derived", "2"],
    ["deploy-substitute", "6"],
  ]) {
    it(`still rejects incomplete ${source} entries during intake`, (context) => {
      const manifest = intakePinManifest();
      Object.assign(manifest.services[0], { source, source_step: sourceStep });
      const { exitCode, stdout } = validateManifest(manifest, context);
      assert.notEqual(exitCode, 0, stdout);
      assert.match(stdout, /iac_logical_names/);
    });
  }
});

describe("SKU Manifest existing-workload subscriptions and provenance", () => {
  const validCases = [
    ["observations across subscriptions without locking them", () => {}],
    [
      "Architect remediation preserving observed SKU and original creation step",
      (m) => Object.assign(m.services[0], { source: "architect-derived", size: "GP_S_Gen5_4" }),
    ],
    [
      "matching service and stamp attribution",
      (m) => {
        m.services[0].subscription = "hub";
        m.stamps[1].subscription = "hub";
      },
    ],
    [
      "service attribution inherited by unassigned stamps",
      (m) => {
        m.services[0].subscription = "spoke";
        for (const stamp of m.stamps) delete stamp.subscription;
      },
    ],
    [
      "single-subscription services without stamps",
      (m) => {
        m.services[0].subscription = "hub";
        delete m.stamps;
      },
    ],
    [
      "explicit user locks alongside observed evidence",
      (m) => {
        m.services[0].source = "user-pin";
      },
    ],
  ];
  for (const [name, mutate] of validCases) {
    it(`accepts ${name}`, (context) => {
      const manifest = existingWorkloadManifest();
      mutate(manifest);
      const { exitCode, stdout } = validateManifest(manifest, context);
      assert.equal(exitCode, 0, stdout);
    });
  }

  it("retains partial observed SKUs without inventing configuration or IaC names", (context) => {
    const manifest = existingWorkloadManifest();
    const service = manifest.services[0];
    for (const key of ["capacity", "zonal", "commitment", "regions", "sla_target", "iac_logical_names"]) {
      delete service[key];
    }
    const { exitCode, stdout } = validateManifest(manifest, context);
    assert.equal(exitCode, 0, stdout);
    const row = renderManifest(manifest)
      .split("\n")
      .find((line) => line.startsWith(`| \`${service.id}\``));
    assert.match(row, /Unknown \| Unknown/);
    assert.match(row, /Unknown \| `observed-current`/);
    assert.doesNotMatch(row, /on-demand/);
    for (const source of ["user-pin", "architect-derived", "deploy-substitute"]) {
      const selected = structuredClone(manifest);
      selected.services[0].source = source;
      const result = validateManifest(selected, context);
      assert.notEqual(result.exitCode, 0, `${source} must still require complete configuration`);
    }
  });

  const invalidCases = [
    ["duplicate logical IDs", (m) => (m.subscriptions[1].id = "hub"), /Duplicate subscriptions\[\]\.id/],
    [
      "duplicate Azure GUIDs ignoring case",
      (m) => (m.subscriptions[1].subscription_id = m.subscriptions[0].subscription_id.toUpperCase()),
      /Duplicate subscriptions\[\]\.subscription_id/,
    ],
    ["invalid Azure GUID", (m) => (m.subscriptions[0].subscription_id = "not-a-guid"), /must match pattern/],
    ["invalid role", (m) => (m.subscriptions[0].role = "unknown"), /must be equal to one of/],
    ["missing display name", (m) => delete m.subscriptions[0].display_name, /display_name/],
    ["empty observed SKU", (m) => (m.services[0].observed_sku = ""), /observed_sku/],
    ["observation without observed SKU", (m) => delete m.services[0].observed_sku, /observed_sku/],
    ["observation at wrong source step", (m) => (m.services[0].source_step = "2"), /expected "1"/],
    [
      "user pin at wrong source step",
      (m) => Object.assign(m.services[0], { source: "user-pin", source_step: "2" }),
      /expected "1"/,
    ],
    [
      "dangling service reference",
      (m) => (m.services[0].subscription = "missing"),
      /services\[sql-db\].subscription references unknown/,
    ],
    [
      "dangling stamp reference",
      (m) => (m.stamps[0].subscription = "missing"),
      /stamps\[tenant-acme\].subscription references unknown/,
    ],
    ["references without inventory", (m) => delete m.subscriptions, /references unknown subscriptions/],
    [
      "conflicting stamp/service attribution even without a service override",
      (m) => (m.services[0].subscription = "hub"),
      /stamps\[tenant-globex\].subscription "spoke" conflicts with services\[sql-db\].subscription "hub"/,
    ],
    [
      "subscription in a sparse stamp override",
      (m) => (m.stamps[0].service_overrides["sql-db"].subscription = "hub"),
      /must NOT have additional properties/,
    ],
    [
      "subscription in an environment override",
      (m) => (m.services[0].environment_overrides = { prod: { subscription: "hub" } }),
      /must NOT have additional properties/,
    ],
  ];
  for (const [name, mutate, diagnostic] of invalidCases) {
    it(`rejects ${name}`, (context) => {
      const manifest = existingWorkloadManifest();
      mutate(manifest);
      const { exitCode, stdout } = validateManifest(manifest, context);
      assert.notEqual(exitCode, 0, stdout);
      assert.match(stdout, diagnostic);
    });
  }
});
