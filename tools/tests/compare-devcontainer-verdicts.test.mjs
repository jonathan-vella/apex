import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { compareVerdicts, loadVerdicts, renderMarkdown } from "../scripts/compare-devcontainer-verdicts.mjs";

function verdict(variant, arch, overrides = {}) {
  return {
    schema_version: 1,
    variant,
    expected_arch: arch,
    observed_arch: arch,
    expected_os: variant === "baseline" ? "24.04" : "26.04",
    observed_os: variant === "baseline" ? "24.04" : "26.04",
    status: "PASS",
    warnings: ["known warning"],
    checks: [],
    ...overrides,
  };
}

function passingVerdicts() {
  return [
    verdict("baseline", "amd64"),
    verdict("candidate", "amd64"),
    verdict("baseline", "arm64"),
    verdict("candidate", "arm64"),
  ];
}

describe("compareDevcontainerVerdicts", () => {
  it("passes when every leg passes and candidates add no warnings", () => {
    const summary = compareVerdicts(passingVerdicts());

    assert.equal(summary.status, "PASS");
    assert.deepEqual(summary.blockers, []);
    assert.deepEqual(summary.new_warnings, { amd64: [], arm64: [] });
  });

  it("blocks on a candidate-only warning", () => {
    const verdicts = passingVerdicts();
    verdicts[1].warnings.push("new Ubuntu 26.04 warning");

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.deepEqual(summary.new_warnings.amd64, ["new Ubuntu 26.04 warning"]);
    assert.match(summary.blockers.join("\n"), /new setup warning/);
  });

  it("blocks when a candidate command fails", () => {
    const verdicts = passingVerdicts();
    verdicts[3].status = "FAIL";
    verdicts[3].checks = [{ name: "terraform-validate", status: "FAIL", category: "compatibility" }];

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /candidate-arm64: validation status is FAIL/);
  });

  it("blocks when a baseline fails", () => {
    const verdicts = passingVerdicts();
    verdicts[0].status = "FAIL";

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /baseline-amd64: validation status is FAIL/);
  });

  it("blocks when a verdict is missing", () => {
    const summary = compareVerdicts(passingVerdicts().slice(0, 3));

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /missing verdict for candidate-arm64/);
  });

  it("blocks when the observed architecture does not match", () => {
    const verdicts = passingVerdicts();
    verdicts[1].observed_arch = "arm64";

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /expected architecture amd64, observed arm64/);
  });

  it("reports malformed verdict JSON as a blocker", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-devcontainer-verdicts-"));
    fs.mkdirSync(path.join(inputDir, "candidate-amd64"));
    fs.writeFileSync(path.join(inputDir, "candidate-amd64", "verdict.json"), "{not-json");

    const loaded = loadVerdicts(inputDir);
    const summary = compareVerdicts(loaded.verdicts, loaded.errors);

    assert.equal(loaded.verdicts.length, 0);
    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /malformed JSON/);
  });

  it("renders a concise Markdown result table", () => {
    const markdown = renderMarkdown(
      compareVerdicts(passingVerdicts(), [], {
        candidateImage: "example/base:26.04",
        candidateDigest: "sha256:abc",
      }),
    );

    assert.match(markdown, /Overall verdict:\*\* PASS/);
    assert.match(markdown, /example\/base:26\.04/);
    assert.match(markdown, /candidate \| arm64 \| 26\.04 \| 26\.04 \| PASS/);
  });
});
