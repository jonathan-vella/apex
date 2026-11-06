import { exampleFixture, fixture } from "../../tests/scripts/fixtures/action-register/fixture.mjs";
import { renderAssessmentActionRegister } from "../../scripts/assessment-action-register.mjs";

const [root, encodedRequest, asOf, finance, encodedPlan] = process.argv.slice(2);
const request = JSON.parse(encodedRequest);
const { data, action, save } = (finance ? exampleFixture : fixture)(root, {
  asOf,
  ...(finance ? { reporting: JSON.parse(encodedPlan) } : {}),
});
data.source = request.source;
data.scopes = request.scope.azure_scopes;
data.as_of = request.reporting.as_of;
data.generated_at = asOf;
if (!finance) {
  data.resources = [];
  data.evidence_refs = data.evidence_refs.filter((ref) => ref.kind === "waf");
  for (const ref of data.evidence_refs) ref.collected_at = asOf;
  data.coverage = { status: "partial", reason: "Synthetic unquantified recommendation; no customer costs inferred." };
  action("unknown", { kind: "unquantified", missing_inputs: ["Authorized billing and sizing evidence unavailable."] });
}
const input = save();
const result = renderAssessmentActionRegister({ root, input, asOf, overwrite: true });
if (!result.valid) throw new Error(result.errors.join("; "));
console.log(JSON.stringify(result));
