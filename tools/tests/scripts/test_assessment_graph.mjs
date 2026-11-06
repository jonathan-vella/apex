import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateAssessmentProfile } from "../../scripts/validate-workflow-graph.mjs";

const graph = JSON.parse(fs.readFileSync(".github/skills/apex-workflow-engine/templates/workflow-graph.json", "utf8"));
const schema = JSON.parse(fs.readFileSync("tools/schemas/workflow-graph.schema.json", "utf8"));
const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);

test("additive graph 3.2 retains delivery and bounded assessment review identities", () => {
  assert.equal(graph.metadata.version, "3.2");
  assert.equal(validate(graph), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateAssessmentProfile(graph.profiles.assessment), []);
  assert.equal(graph.nodes["step-3_5"].agent, "04g-Governance");
  assert.ok(graph.edges.some((edge) => edge.to === "step-4"));
  assert.equal(graph.profiles.assessment.reviews["cost-feasibility"].artifact_type, "cost-estimate");
});

for (const [label, change] of [
  ["delivery escape", (profile) => profile.edges.push({ from: "terminal", to: "step-4", condition: "on_complete" })],
  ["diagram bypass", (profile) => (profile.edges.find((edge) => edge.from === "analysis").to = "review")],
  ["review bypass", (profile) => (profile.edges.find((edge) => edge.from === "diagram").to = "acceptance")],
  ["requirements forced in evidence-only", (profile) => delete profile.edges[0].scenario],
  ["new cost budget identity", (profile) => (profile.reviews["cost-feasibility"].artifact_type = "new-cost-lens")],
  ["reserved projection output", (profile) => profile.nodes.analysis.produces.push("_meta/assessment-step-2.json")],
  ["formal governance owner", (profile) => (profile.nodes.evidence.agent = "04g-Governance")],
  ["extra approval", (profile) => (profile.nodes.diagram.type = "gate")],
  ["missing mandatory render", (profile) => (profile.nodes.diagram.produces = ["assets/03-des-diagram.py"])],
  ["terminal repair reopening", (profile) => (profile.return_edges[0].from = "terminal")],
  ["missing bounded repair return", (profile) => delete profile.return_edges],
  [
    "register made unconditional for old runs",
    (profile) => profile.nodes.analysis.produces.push("04-assessment-action-register.md"),
  ],
  ["register omitted", (profile) => delete profile.nodes.analysis.conditional_produces],
  [
    "register condition silently excludes Azure",
    (profile) => profile.nodes.analysis.conditional_produces[0].when.sources.pop(),
  ],
  [
    "file-presence selection",
    (profile) => (profile.nodes.analysis.conditional_produces[0].when.selection = "file_exists"),
  ],
  ["unknown bundle contract", (profile) => profile.bundle_contracts.push("assessment-bundle-v999")],
]) {
  test(`assessment profile rejects ${label}`, () => {
    const profile = structuredClone(graph.profiles.assessment);
    change(profile);
    assert.ok(validateAssessmentProfile(profile).length > 0);
  });
}

test("unknown graph version fails closed; old delivery graph remains readable", () => {
  const future = structuredClone(graph);
  future.metadata.version = "3.999";
  assert.equal(validate(future), false);
  const legacyAssessment = structuredClone(graph);
  legacyAssessment.metadata.version = "3.1";
  delete legacyAssessment.profiles.assessment.bundle_contracts;
  delete legacyAssessment.profiles.assessment.nodes.analysis.conditional_produces;
  assert.equal(validate(legacyAssessment), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateAssessmentProfile(legacyAssessment.profiles.assessment, "3.1"), []);
  assert.ok(validateAssessmentProfile(graph.profiles.assessment, "3.1").length > 0);
  const previous = structuredClone(graph);
  previous.metadata.version = "3.0";
  delete previous.profiles;
  assert.equal(validate(previous), true, JSON.stringify(validate.errors));
});

test("assessment request schema rejects mismatched source, invented mode, and reserved projection paths", () => {
  const sessionSchema = JSON.parse(fs.readFileSync("tools/schemas/session-state.schema.json", "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(sessionSchema);
  const validateRequest = ajv.compile({ $ref: `${sessionSchema.$id}#/$defs/assessmentRequest` });
  const request = {
    scenario: "evidence_only",
    source: "iac",
    receipt: { owner: "fixture-owner", request_id: "actual-fixture-owner-response", approved: true },
    scope: { categories: ["configuration"], iac_paths: ["infra/fixture"], azure_scopes: [] },
    reporting: {
      as_of: "2026-11-06T00:00:00Z",
      periods: [{ id: "previous_month", from: "2026-10-01", to: "2026-10-31" }],
      currency: null,
    },
  };
  assert.equal(validateRequest(request), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateRequest({ ...request, source: "azure" }), false);
  assert.equal(validateRequest({ ...request, scenario: "business_interview" }), false);
  assert.equal(validateRequest({ ...request, workflow_mode: "anything" }), false);
  assert.equal(
    validateRequest({ ...request, scope: { ...request.scope, iac_paths: ["_meta/assessment-step-2.json"] } }),
    false,
  );
  assert.equal(validateRequest({ ...request, receipt: { ...request.receipt, approved: false } }), false);
  assert.equal(validateRequest({ ...request, action_register: true }), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateRequest({ ...request, action_register: "yes" }), false);
});
