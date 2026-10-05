import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAudit } from "../../scripts/check-npm-audit.mjs";

const exception = {
  advisory: "GHSA-vfj7-8cjw-p6xm",
  package: "braces",
  installed: ["3.0.3"],
  via: ["markdownlint-cli2"],
  severity: "high",
  rationale: "No patched release exists for this dev-only dependency.",
  accepted_on: "2026-10-05",
  review_by: "2027-01-05",
};
const lockPackages = {
  "node_modules/braces": { version: "3.0.3" },
  "node_modules/micromatch": { version: "4.0.8" },
  "node_modules/markdownlint-cli2": { version: "0.23.3" },
};
const advisory = (name, id, severity = "high") => ({
  name,
  url: `https://github.com/advisories/${id}`,
  severity,
  title: `${name} advisory`,
});
const report = (extra = {}) => ({
  vulnerabilities: {
    braces: {
      severity: "high",
      isDirect: false,
      via: [advisory("braces", exception.advisory)],
      nodes: ["node_modules/braces"],
    },
    micromatch: { severity: "high", isDirect: false, via: ["braces"], nodes: ["node_modules/micromatch"] },
    "markdownlint-cli2": {
      severity: "high",
      isDirect: true,
      via: ["micromatch"],
      nodes: ["node_modules/markdownlint-cli2"],
    },
    ...extra,
  },
});
const evaluate = (overrides = {}) =>
  evaluateAudit({ report: report(), exceptions: [exception], lockPackages, today: "2026-10-05", ...overrides });

test("accepted advisory and the parents it explains pass", () => {
  const result = evaluate();
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.covered.length, 3);
});

test("a new high advisory fails even on an already-excepted package", () => {
  const result = evaluate({
    report: report({
      braces: {
        severity: "high",
        isDirect: false,
        via: [advisory("braces", exception.advisory), advisory("braces", "GHSA-aaaa-bbbb-cccc")],
        nodes: ["node_modules/braces"],
      },
    }),
  });
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /GHSA-aaaa-bbbb-cccc/);
});

test("a changed installed version is a new finding", () => {
  const result = evaluate({ lockPackages: { ...lockPackages, "node_modules/braces": { version: "3.0.4" } } });
  assert.ok(result.errors.some((line) => /^braces /.test(line)));
});

test("an expired exception fails", () => {
  const result = evaluate({ today: "2027-01-06" });
  assert.ok(result.errors.some((line) => /expired on 2027-01-05/.test(line)));
});

test("a direct dependency newly carrying the advisory needs review", () => {
  const result = evaluate({
    report: report({
      eslint: { severity: "high", isDirect: true, via: ["micromatch"], nodes: ["node_modules/eslint"] },
    }),
  });
  assert.ok(result.errors.some((line) => /^eslint now carries GHSA-vfj7-8cjw-p6xm/.test(line)));
});

test("moderate unaccepted advisories warn without failing", () => {
  const result = evaluate({
    report: report({
      "fast-uri": {
        severity: "moderate",
        isDirect: false,
        via: [advisory("fast-uri", "GHSA-hrr3-gc8f-f4qj", "moderate")],
        nodes: [],
      },
    }),
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
});

test("an exception without a matching advisory is reported for removal", () => {
  const result = evaluate({ report: { vulnerabilities: {} } });
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings[0], /no longer matches npm audit; remove it/);
});

test("an npm audit error payload fails closed", () => {
  const result = evaluate({ report: { error: { summary: "registry unreachable" } } });
  assert.match(result.errors[0], /registry unreachable/);
});
