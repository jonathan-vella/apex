import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { computeWafScores, verifyWafScores } from "../../scripts/assessment-waf-scores.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("verifyWafScores matches the real partner-modernization-factory-v2 WAF checks and scores when present", (t) => {
  const checksPath = path.join(root, "agent-output/partner-modernization-factory-v2/_meta/waf-checks.json");
  const scoresPath = path.join(root, "agent-output/partner-modernization-factory-v2/_meta/waf-scores.json");
  if (!fs.existsSync(checksPath) || !fs.existsSync(scoresPath)) {
    t.skip("partner-modernization-factory-v2 bundle not present in upstream repository");
    return;
  }
  const checks = JSON.parse(fs.readFileSync(checksPath, "utf8"));
  const scores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));
  const computed = verifyWafScores(checks, scores);
  assert.equal(computed.pillars.length, 5);
  const cost = computed.pillars.find((p) => p.pillar === "Cost Optimization");
  assert.equal(cost.status, "not_assessed");
  assert.equal(cost.score, null);
  assert.equal(cost.confidence, "Low");
});

test("computeWafScores enforces >=2 observed threshold, tradeoff weighting, and excludes attested_practices from 0-10 scores", () => {
  const doc = {
    schema_version: "assessment-waf-checks-v1",
    project: "demo-waf",
    as_of: "2026-11-26T12:00:00.000Z",
    evidence_availability: [
      {
        id: "EA01",
        pillar: "Cost Optimization",
        state: "observed",
        check: "Billing query succeeded",
        evidence: "contracts/03-cost-management.json",
      },
    ],
    attested_practices: [
      {
        input_id: "dr_testing_cadence",
        pillars: ["Reliability"],
        value: "Regular restore and failover drills in production-like environments",
        provenance: "declared",
      },
    ],
    checks: [
      { id: "S1", pillar: "Security", state: "passed", check: "HTTPS only", evidence: "_meta/controls-evidence.json" },
      { id: "S2", pillar: "Security", state: "passed", check: "TLS 1.2", evidence: "_meta/controls-evidence.json" },
      { id: "S3", pillar: "Security", state: "passed", check: "RBAC vault", evidence: "_meta/controls-evidence.json" },
      {
        id: "S4",
        pillar: "Security",
        state: "risk",
        check: "Public web ingress",
        evidence: "_meta/controls-evidence.json",
      },
      {
        id: "R1",
        pillar: "Reliability",
        state: "passed",
        check: "Zonal Service Bus",
        evidence: "_meta/controls-evidence.json",
      },
      {
        id: "R2",
        pillar: "Reliability",
        state: "intentional_tradeoff",
        check: "Single-instance lab plan",
        evidence: "_meta/controls-evidence.json",
      },
      { id: "R3", pillar: "Reliability", state: "unknown", check: "Restore test", evidence: "_meta/user-brief.json" },
      { id: "R4", pillar: "Reliability", state: "unknown", check: "RTO proof", evidence: "_meta/user-brief.json" },
      {
        id: "C1",
        pillar: "Cost Optimization",
        state: "passed",
        check: "Auto-shutdown schedule",
        evidence: "_meta/controls-evidence.json",
      },
      {
        id: "P1",
        pillar: "Performance Efficiency",
        state: "not_applicable",
        check: "CDN edge caching",
        evidence: "_meta/user-brief.json",
      },
    ],
  };

  const scores = computeWafScores(doc);
  const byPillar = Object.fromEntries(scores.pillars.map((p) => [p.pillar, p]));
  assert.equal(byPillar.Security.status, "scored");
  assert.equal(byPillar.Security.score, 7.5);
  assert.equal(byPillar.Security.confidence, "High");

  // Reliability: 2 observed (1 passed + 1 tradeoff = 1.5 pts -> 7.5/10), 2 unknown -> 2/4 = 50% Medium; attested_practices excluded!
  assert.equal(byPillar.Reliability.status, "scored");
  assert.equal(byPillar.Reliability.score, 7.5);
  assert.equal(byPillar.Reliability.confidence, "Medium");

  // Cost Optimization: only 1 observed workload check (evidence_availability EA01 excluded!) -> not_assessed
  assert.equal(byPillar["Cost Optimization"].status, "not_assessed");
  assert.equal(byPillar["Cost Optimization"].score, null);

  // Performance Efficiency: only not_applicable -> 0/0 -> Low, not_assessed
  assert.equal(byPillar["Performance Efficiency"].status, "not_assessed");
  assert.equal(byPillar["Performance Efficiency"].confidence, "Low");

  // Reject uncorroborated human attestation injected into scored checks[]
  assert.throws(
    () =>
      computeWafScores({
        ...doc,
        checks: [
          ...doc.checks,
          { id: "BAD1", pillar: "Security", state: "passed", provenance: "attested", check: "x", evidence: "y" },
        ],
      }),
    /attested_practices/,
  );

  // Reject drifted score in verifyWafScores
  const drifted = structuredClone(scores);
  drifted.pillars[0].score = 9.9;
  assert.throws(() => verifyWafScores(doc, drifted), /WAF scores drift/);
});

test("assessment-waf-scores CLI computes and verifies files cleanly", (t) => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".apex-waf-scores-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const metaDir = path.join(dir, "sample-proj", "_meta");
  fs.mkdirSync(metaDir, { recursive: true });
  const checksFile = path.join(metaDir, "waf-checks.json");
  const scoresFile = path.join(metaDir, "waf-scores.json");
  fs.writeFileSync(
    checksFile,
    JSON.stringify({
      generated_at: "2026-11-26T12:00:00.000Z",
      checks: [
        { id: "C1", pillar: "Security", state: "passed", check: "HTTPS", evidence: "e" },
        { id: "C2", pillar: "Security", state: "passed", check: "RBAC", evidence: "e" },
      ],
    }),
  );

  const script = path.join(root, "tools/scripts/assessment-waf-scores.mjs");
  const compute = spawnSync(process.execPath, [script, "compute", "--checks", checksFile, "--out", scoresFile], {
    encoding: "utf8",
  });
  assert.equal(compute.status, 0, compute.stderr);
  assert.ok(fs.existsSync(scoresFile));

  const verify = spawnSync(process.execPath, [script, "verify", "--checks", checksFile, "--scores", scoresFile], {
    encoding: "utf8",
  });
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).project, "sample-proj");

  const bad = spawnSync(process.execPath, [script, "unknown", "--checks", checksFile], { encoding: "utf8" });
  assert.equal(bad.status, 1);

  // When assessment-scope.json exists in _meta/, compute resolves reporting.as_of ahead of generated_at
  fs.writeFileSync(
    path.join(metaDir, "assessment-scope.json"),
    JSON.stringify({ reporting: { as_of: "2026-11-26T09:15:00.000Z" } }),
  );
  const recompute = spawnSync(process.execPath, [script, "compute", "--checks", checksFile, "--out", scoresFile], {
    encoding: "utf8",
  });
  assert.equal(recompute.status, 0, recompute.stderr);
  assert.equal(JSON.parse(fs.readFileSync(scoresFile, "utf8")).as_of, "2026-11-26T09:15:00.000Z");

  // verifyWafScores rejects project or as_of mismatch when checksDoc explicitly declares them
  const savedScores = JSON.parse(fs.readFileSync(scoresFile, "utf8"));
  assert.throws(
    () =>
      verifyWafScores(
        {
          project: "different-proj",
          checks: [
            { id: "C1", pillar: "Security", state: "passed", check: "HTTPS", evidence: "e" },
            { id: "C2", pillar: "Security", state: "passed", check: "RBAC", evidence: "e" },
          ],
        },
        savedScores,
      ),
    /WAF project mismatch/,
  );
  assert.throws(
    () =>
      verifyWafScores(
        {
          as_of: "2026-11-26T00:00:00.000Z",
          checks: [
            { id: "C1", pillar: "Security", state: "passed", check: "HTTPS", evidence: "e" },
            { id: "C2", pillar: "Security", state: "passed", check: "RBAC", evidence: "e" },
          ],
        },
        savedScores,
      ),
    /WAF as_of mismatch/,
  );

  // CLI compute on real partner-modernization-factory-v2/_meta/waf-checks.json when present
  const factoryChecksPath = path.join(root, "agent-output/partner-modernization-factory-v2/_meta/waf-checks.json");
  const factoryScoresPath = path.join(root, "agent-output/partner-modernization-factory-v2/_meta/waf-scores.json");
  if (fs.existsSync(factoryChecksPath) && fs.existsSync(factoryScoresPath)) {
    const factoryOut = path.join(dir, "factory-scores.json");
    const factoryCompute = spawnSync(
      process.execPath,
      [script, "compute", "--checks", factoryChecksPath, "--out", factoryOut],
      { encoding: "utf8" },
    );
    assert.equal(factoryCompute.status, 0, factoryCompute.stderr);
    const computedFactory = JSON.parse(fs.readFileSync(factoryOut, "utf8"));
    const expectedFactory = JSON.parse(fs.readFileSync(factoryScoresPath, "utf8"));
    assert.equal(computedFactory.project, expectedFactory.project);
    assert.equal(computedFactory.as_of, expectedFactory.as_of);
    for (let i = 0; i < 5; i += 1) {
      const { notes: _a, ...actualRest } = computedFactory.pillars[i];
      const { notes: _e, ...expectedRest } = expectedFactory.pillars[i];
      assert.deepEqual(actualRest, expectedRest);
    }
  }
});
