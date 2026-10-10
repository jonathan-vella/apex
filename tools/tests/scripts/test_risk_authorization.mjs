import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { evaluateAuthorization, requiredPlanInputs } from "../../scripts/evaluate-risk-authorization.mjs";
import { validateProject } from "../../scripts/validate-risk-authorizations.mjs";
import { computeTreeHash } from "../../scripts/validate-iac-handoff.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const repoFile = (relative) => fs.readFileSync(new URL(`../../../${relative}`, import.meta.url), "utf8");

test("required Plan coverage matches frozen graph inputs and reviewer guidance", () => {
  const graph = JSON.parse(repoFile(".github/skills/apex-workflow-engine/templates/workflow-graph.json"));
  const frozen = graph.nodes["step-5b"].frozen_inputs.filter((name) => name !== "04-implementation-plan.md");
  assert.deepEqual([...requiredPlanInputs].sort(), [...frozen].sort());
  const reference = repoFile(".github/skills/apex-iac-common/references/contract-emission-and-handoff.md");
  for (const name of requiredPlanInputs) assert.ok(reference.includes(`\`${name}\``), name);
  assert.match(reference, /Exclude\s+`sku-manifest.json`/);
  assert.match(repoFile(".github/agents/05-iac-planner.agent.md"), /`supporting_paths` = the frozen Step 4 inputs/);
  assert.match(repoFile(".github/agents/_subagents/challenger-review-subagent.agent.md"), /--supporting-input <path>/);
});

function fixture(t) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "apex-risk-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const root = path.join(scratch, "workspace");
  const project = "synthetic";
  const directory = path.join(root, "agent-output", project);
  fs.mkdirSync(directory, { recursive: true });
  const keys = generateKeyPairSync("ed25519");
  const reviewerKeys = generateKeyPairSync("ed25519");
  const now = Date.now();
  const timestamp = (offset) => new Date(now + offset).toISOString().replace(/\.\d{3}Z$/, "Z");
  const window = { not_before: timestamp(-60000), expires_at: timestamp(3600000) };
  const write = (name, value) => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
    return { path: path.relative(root, file), sha256: sha(fs.readFileSync(file)) };
  };
  const envelope = (name, document, reviewer = false) => {
    const payload = Buffer.from(JSON.stringify(document));
    return write(name, {
      schema_version: "risk-envelope-v1",
      key_id: reviewer ? "reviewer" : "owner",
      payload: payload.toString("base64"),
      signature: sign(null, payload, reviewer ? reviewerKeys.privateKey : keys.privateKey).toString("base64"),
    });
  };
  const supporting = [
    "04-iac-contract.json",
    "04-policy-property-map.json",
    "04-environment-manifest.json",
    "04-governance-constraints.md",
    "04-governance-constraints.json",
  ].map((name) => write(name, "{}"));
  const artifact = write("04-implementation-plan.md", "# Synthetic lab");
  const review = write("challenge-findings-plan.json", {
    challenged_artifact: artifact.path,
    cache_inputs: {
      artifact_sha: artifact.sha256,
      checklists_sha: "a",
      protocol_sha: "b",
      subagent_sha: "c",
      model: "fixture",
      artifact_hash: "d",
    },
    supporting_inputs: supporting,
    findings: [{ id: "abcdef01", severity: "must_fix" }],
    overall_assessment: "NEEDS_REVISION",
  });
  const proof = write("eligibility.json", {
    classification: "best-practice",
    source: "independent synthetic assessment",
  });
  const eligibility = {
    schema_version: "risk-eligibility-v1",
    id: "eligibility-1",
    project,
    actions: ["plan-complete", "codegen"],
    ...window,
    review_sha256: review.sha256,
    finding_id: "abcdef01",
    classification: "best-practice",
    rule_reference: "optional lab guidance",
    applicable_law: false,
    mandatory_requirement: false,
    technical_deployment_possible: true,
    source_evidence: [proof],
  };
  const document = {
    schema_version: "risk-authorization-v1",
    id: "kit-1",
    project,
    scope: { kind: "kit", environment: "non-production-lab", operation: "author lab kit" },
    actions: ["plan-complete", "codegen"],
    issued_at: timestamp(-60000),
    ...window,
    revocation_conditions: [
      "input-change",
      "scope-change",
      "authority-revoked",
      "authorization-revoked",
      "validity-expired",
    ],
    authority_evidence: "external delegation record 1",
    preserved_reviews: [],
    bindings: [
      {
        review,
        artifact,
        cache_inputs: JSON.parse(fs.readFileSync(path.join(root, review.path))).cache_inputs,
        supporting_inputs: supporting,
        findings: [
          {
            id: "abcdef01",
            classification: "best-practice",
            rule_reference: "optional lab guidance",
            rationale: "remediation infeasible for exercise",
            residual_impact: "limited lab capability",
            owner: "lab owner",
            eligibility_evidence: [],
          },
        ],
      },
    ],
    obligations: [
      {
        id: "verify-scope",
        phase: "before-plan",
        owner: "lab owner",
        requirement: "independently verify isolated lab scope",
      },
    ],
  };
  const trust = {
    schema_version: "risk-trust-v1",
    ...window,
    revoked_ids: [],
    revoked_keys: [],
    grants: [
      {
        key_id: "owner",
        principal: "fixture owner",
        public_key: keys.publicKey.export({ type: "spki", format: "pem" }),
        roles: ["kit-maintainer", "human-gate-approver"],
        projects: [project],
        actions: ["plan-complete", "codegen", "deploy"],
        authority_evidence: document.authority_evidence,
        ...window,
        tenants: [],
        subscriptions: [],
      },
    ],
  };
  const trustPath = path.join(scratch, "trust.json");
  trust.grants.push({
    ...trust.grants[0],
    key_id: "reviewer",
    principal: "independent reviewer",
    public_key: reviewerKeys.publicKey.export({ type: "spki", format: "pem" }),
    roles: ["eligibility-reviewer"],
  });
  const environment = {};
  const refreshTrust = () => {
    fs.writeFileSync(trustPath, JSON.stringify(trust), { mode: 0o600 });
    environment.APEX_RISK_TRUST_CONFIG = trustPath;
    environment.APEX_RISK_TRUST_SHA256 = sha(fs.readFileSync(trustPath));
  };
  refreshTrust();
  const request = {
    root,
    project,
    action: "plan-complete",
    reviews: [review.path],
    authorization: "",
    require_approval: true,
  };
  const refresh = () => {
    document.bindings[0].findings[0].eligibility_evidence = [envelope("risk-eligibility.json", eligibility, true)];
    const auth = envelope("risk-authorization.json", document);
    request.authorization = auth.path;
    request.approval = envelope("risk-gate-approval.json", {
      schema_version: "risk-gate-approval-v1",
      id: "gate-1",
      project,
      authorization_sha256: auth.sha256,
      actions: document.actions,
      approved_at: timestamp(-30000),
      ...window,
      verified_obligations: [{ id: "verify-scope", evidence: proof }],
    }).path;
  };
  refresh();
  return {
    document,
    eligibility,
    trust,
    request,
    environment,
    refresh,
    refreshTrust,
    root,
    proof,
    timestamp,
    envelope,
    write,
    window,
  };
}

function deployment(data) {
  const actions = ["deploy", "deployment-complete", "teardown-complete"];
  data.document.actions = data.eligibility.actions = actions;
  const tree = path.join(data.root, "infra", "bicep", "synthetic");
  fs.mkdirSync(tree, { recursive: true });
  fs.writeFileSync(path.join(tree, "main.bicep"), "param example string");
  const treeHash = computeTreeHash(tree).value;
  const inputs = data.write("parameters.json", { example: "lab" });
  const context = {
    tenant_id: "lab-tenant",
    subscription_id: "lab-subscription",
    event_id: "event-1",
    environment: "non-production-lab",
    operation: "deploy isolated lab",
    phase: "lab-phase",
    tree_hash: treeHash,
    tree: { path: path.relative(data.root, tree), sha256: treeHash },
    input_refs: [inputs],
    inputs_hash: sha(JSON.stringify([[inputs.path, inputs.sha256]])),
  };
  data.document.scope = {
    kind: "deployment",
    tenant_id: context.tenant_id,
    subscription_id: context.subscription_id,
    event_id: context.event_id,
    environment: context.environment,
    operation: context.operation,
    event_expires_at: data.timestamp(600000),
    cleanup_owner: "cleanup owner",
    teardown_due_at: data.timestamp(1800000),
    deployment_context: data.write("deployment-context.json", context),
  };
  data.document.obligations.push({
    id: "teardown",
    phase: "after-teardown",
    owner: "cleanup owner",
    requirement: "collect actual teardown evidence after execution",
  });
  data.document.obligations[0].phase = "before-deploy";
  data.document.obligations.push({
    id: "execution",
    phase: "after-execution",
    owner: "cleanup owner",
    requirement: "collect actual execution evidence after deployment",
  });
  data.trust.grants[0].roles.push("deployment-risk-owner");
  for (const grant of data.trust.grants) {
    grant.actions = actions;
    grant.tenants = [context.tenant_id];
    grant.subscriptions = [context.subscription_id];
  }
  data.request.context = data.document.scope.deployment_context.path;
  data.request.action = "deploy";
  data.refreshTrust();
  data.refresh();
  return { tree, inputs, context };
}

test("CI checks the active CodeGen phase rather than a stale deployment pointer", (t) => {
  const data = fixture(t);
  data.write("00-session-state.json", {
    project: "synthetic",
    current_step: 5,
    decisions: { plan_status: "EXCEPTION_AUTHORIZED" },
    risk_authorizations: { codegen: { schema_version: "risk-selection-v1" } },
    steps: { 5: { status: "in_progress" }, 6: { status: "in_progress" } },
  });
  const actions = [];
  assert.deepEqual(
    validateProject(data.root, "synthetic", (command, args) => {
      actions.push(args[args.indexOf("--action") + 1]);
      return { status: 0 };
    }),
    [],
  );
  assert.deepEqual(actions, ["codegen"]);
  data.write("00-session-state.json", {
    project: "synthetic",
    current_step: 3,
    decisions: { plan_status: "EXCEPTION_AUTHORIZED" },
    risk_authorizations: { codegen: {} },
    steps: {},
  });
  assert.match(validateProject(data.root, "synthetic")[0], /unsupported active step/);
});

test("mandatory deviation needs an exact signed rule-authority exception, never ordinary consent", (t) => {
  const data = fixture(t);
  const finding = data.document.bindings[0].findings[0];
  finding.classification = data.eligibility.classification = "mandatory-with-exception";
  data.eligibility.mandatory_requirement = true;
  data.trust.grants[1].roles.push("mandatory-exception-owner");
  data.trust.grants[1].rules = [finding.rule_reference];
  const permission = {
    schema_version: "risk-mandatory-exception-v1",
    id: "rule-exception-1",
    project: "synthetic",
    actions: data.document.actions,
    ...data.window,
    review_sha256: data.document.bindings[0].review.sha256,
    finding_id: finding.id,
    rule_reference: finding.rule_reference,
    authority_evidence: data.trust.grants[1].authority_evidence,
    scope: data.document.scope,
    source_evidence: [data.proof],
  };
  finding.mandatory_exception = data.envelope("rule-exception.json", permission, true);
  data.refreshTrust();
  data.refresh();
  assert.equal(evaluateAuthorization(data.request, data.environment).status, "exception-authorized");
  data.trust.grants[1].rules = ["different mandatory rule"];
  data.refreshTrust();
  assert.throws(() => evaluateAuthorization(data.request, data.environment), /exact rule\/scope authority/);
});

test("separate adopter lab approval permits deployment without premature teardown evidence", (t) => {
  const data = fixture(t);
  deployment(data);
  assert.equal(evaluateAuthorization(data.request, data.environment).status, "exception-authorized");
  data.request.action = "teardown-complete";
  assert.throws(() => evaluateAuthorization(data.request, data.environment), /verification missing/);
});

test("tool output in the IaC tree does not invalidate a lab deployment approval", (t) => {
  const data = fixture(t);
  const { tree } = deployment(data);
  for (const name of ["main.json", "tfplan", "terraform.tfstate"])
    fs.writeFileSync(path.join(tree, name), "tool output");
  assert.equal(evaluateAuthorization(data.request, data.environment).status, "exception-authorized");
  fs.writeFileSync(path.join(tree, "main.bicep"), "param changed string");
  assert.throws(() => evaluateAuthorization(data.request, data.environment), /tree changed/);
});

test("post-execution completion requires independently verified chronology and a later human approval", (t) => {
  const data = fixture(t);
  deployment(data);
  data.trust.grants[1].roles.push("lifecycle-verifier");
  data.refreshTrust();
  const receipt = {
    schema_version: "risk-lifecycle-receipt-v1",
    id: "execution-1",
    project: "synthetic",
    actions: data.document.actions,
    ...data.window,
    scope: data.document.scope,
    context_sha256: data.document.scope.deployment_context.sha256,
    execution_id: "actual-event-execution",
    phase: "execution",
    started_at: data.timestamp(-50000),
    finished_at: data.timestamp(-40000),
    observed_at: data.timestamp(-35000),
    source_evidence: [data.proof],
  };
  const execution = data.envelope("execution-receipt.json", receipt, true);
  data.request.action = "deployment-complete";
  const issueApproval = (approvedAt) => {
    data.request.approval = data.envelope("completion-approval.json", {
      schema_version: "risk-gate-approval-v1",
      id: "completion-1",
      project: "synthetic",
      authorization_sha256: sha(fs.readFileSync(path.join(data.root, data.request.authorization))),
      actions: ["deployment-complete"],
      approved_at: approvedAt,
      ...data.window,
      verified_obligations: [
        { id: "verify-scope", evidence: data.proof },
        { id: "execution", evidence: execution },
      ],
    }).path;
  };
  issueApproval(data.timestamp(-55000));
  assert.throws(() => evaluateAuthorization(data.request, data.environment), /must follow actual execution/);
  issueApproval(data.timestamp(-30000));
  assert.equal(evaluateAuthorization(data.request, data.environment).status, "exception-authorized");
});

for (const defect of [
  "unapproved",
  "tenant",
  "subscription",
  "event-expired",
  "missing-cleanup",
  "changed-tree",
  "changed-inputs",
  "wrong-phase",
  "production",
]) {
  test(`lab deployment ${defect} fails closed`, (t) => {
    const data = fixture(t);
    const context = deployment(data);
    if (defect === "tenant") data.trust.grants[0].tenants = [];
    if (defect === "subscription") data.trust.grants[0].subscriptions = [];
    if (defect === "event-expired") data.document.scope.event_expires_at = data.timestamp(-1000);
    if (defect === "missing-cleanup") delete data.document.scope.cleanup_owner;
    if (defect === "production") data.document.scope.environment = "production";
    data.refreshTrust();
    data.refresh();
    if (defect === "unapproved") delete data.request.approval;
    if (defect === "changed-tree") fs.appendFileSync(path.join(context.tree, "main.bicep"), "changed");
    if (defect === "changed-inputs") fs.appendFileSync(path.join(data.root, context.inputs.path), "changed");
    if (defect === "wrong-phase")
      fs.writeFileSync(
        path.join(data.root, data.request.context),
        JSON.stringify({ ...context.context, phase: "different" }),
      );
    assert.throws(() => evaluateAuthorization(data.request, data.environment));
  });
}

for (const reverse of [false, true]) {
  test(`different execution receipts cannot mask boundaries regardless of order ${reverse}`, (t) => {
    const data = fixture(t);
    deployment(data);
    data.trust.grants[1].roles.push("lifecycle-verifier");
    data.document.obligations.push({
      id: "execution-again",
      phase: "after-execution",
      owner: "cleanup owner",
      requirement: "verify same execution",
    });
    data.refreshTrust();
    data.refresh();
    const receipt = {
      schema_version: "risk-lifecycle-receipt-v1",
      id: "execution-a",
      project: "synthetic",
      actions: data.document.actions,
      ...data.window,
      scope: data.document.scope,
      context_sha256: data.document.scope.deployment_context.sha256,
      execution_id: "execution-a",
      phase: "execution",
      started_at: data.timestamp(-50000),
      finished_at: data.timestamp(-40000),
      observed_at: data.timestamp(-35000),
      source_evidence: [data.proof],
    };
    const first = data.envelope("execution-a.json", receipt, true);
    const second = data.envelope(
      "execution-b.json",
      { ...receipt, id: "execution-b", execution_id: "execution-b", started_at: data.timestamp(-45000) },
      true,
    );
    const entries = [
      { id: "execution", evidence: first },
      { id: "execution-again", evidence: second },
    ];
    if (reverse) entries.reverse();
    data.request.action = "deployment-complete";
    const issue = (evidence) => {
      data.request.approval = data.envelope("completion.json", {
        schema_version: "risk-gate-approval-v1",
        id: "completion",
        project: "synthetic",
        authorization_sha256: sha(fs.readFileSync(path.join(data.root, data.request.authorization))),
        actions: ["deployment-complete"],
        approved_at: data.timestamp(-30000),
        ...data.window,
        verified_obligations: [{ id: "verify-scope", evidence: data.proof }, ...evidence],
      }).path;
    };
    issue(entries);
    assert.throws(() => evaluateAuthorization(data.request, data.environment), /canonical execution/);
    issue(entries.map((entry) => ({ ...entry, evidence: first })));
    assert.equal(evaluateAuthorization(data.request, data.environment).status, "exception-authorized");
  });
}

test("teardown cannot certify a different execution run", (t) => {
  const data = fixture(t);
  deployment(data);
  data.trust.grants[1].roles.push("lifecycle-verifier");
  data.refreshTrust();
  const receipt = {
    schema_version: "risk-lifecycle-receipt-v1",
    id: "execution-a",
    project: "synthetic",
    actions: data.document.actions,
    ...data.window,
    scope: data.document.scope,
    context_sha256: data.document.scope.deployment_context.sha256,
    execution_id: "execution-a",
    phase: "execution",
    started_at: data.timestamp(-50000),
    finished_at: data.timestamp(-40000),
    observed_at: data.timestamp(-35000),
    source_evidence: [data.proof],
  };
  const first = data.envelope("execution-a.json", receipt, true);
  const second = data.envelope(
    "execution-b.json",
    { ...receipt, id: "execution-b", execution_id: "execution-b" },
    true,
  );
  const teardown = data.envelope(
    "teardown.json",
    {
      ...receipt,
      id: "teardown",
      execution_id: "execution-b",
      phase: "teardown",
      prior_execution: second,
      started_at: data.timestamp(-30000),
      finished_at: data.timestamp(-20000),
      observed_at: data.timestamp(-15000),
    },
    true,
  );
  data.request.action = "teardown-complete";
  data.request.approval = data.envelope("completion.json", {
    schema_version: "risk-gate-approval-v1",
    id: "completion",
    project: "synthetic",
    authorization_sha256: sha(fs.readFileSync(path.join(data.root, data.request.authorization))),
    actions: ["teardown-complete"],
    approved_at: data.timestamp(-10000),
    ...data.window,
    verified_obligations: [
      { id: "verify-scope", evidence: data.proof },
      { id: "execution", evidence: first },
      { id: "teardown", evidence: teardown },
    ],
  }).path;
  assert.throws(() => evaluateAuthorization(data.request, data.environment), /canonical execution/);
});

test("explicit kit authorization preserves unresolved verdict and permits listed actions only", (t) => {
  const fixtureData = fixture(t);
  for (const action of ["plan-complete", "codegen"]) {
    fixtureData.request.action = action;
    const result = evaluateAuthorization(fixtureData.request, fixtureData.environment);
    assert.equal(result.status, "exception-authorized");
    assert.equal(result.unresolved_findings[0].severity, "must_fix");
  }
  fixtureData.request.action = "deploy";
  assert.throws(() => evaluateAuthorization(fixtureData.request, fixtureData.environment));
});

for (const defect of [
  "missing-authority",
  "forged-signature",
  "expired",
  "revoked",
  "changed-hash",
  "extra-finding",
  "wrong-project",
  "wrong-action",
  "production",
  "missing-approval",
  "mandatory",
  "trust-tamper",
]) {
  test(`${defect} blocks authorization`, (t) => {
    const data = fixture(t);
    if (defect === "missing-authority") data.environment.APEX_RISK_TRUST_CONFIG = "";
    if (defect === "expired") data.document.expires_at = data.timestamp(-10000);
    if (defect === "revoked") {
      data.trust.revoked_ids.push(data.document.id);
      data.refreshTrust();
    }
    if (defect === "extra-finding")
      data.document.bindings[0].findings.push({ ...data.document.bindings[0].findings[0], id: "abcdef02" });
    if (defect === "wrong-project") data.request.project = "other";
    if (defect === "wrong-action") data.request.action = "code-complete";
    if (defect === "production") data.document.scope.environment = "production";
    if (defect === "mandatory") data.document.bindings[0].findings[0].classification = "mandatory-with-exception";
    data.refresh();
    if (defect === "missing-approval") delete data.request.approval;
    if (defect === "changed-hash") fs.appendFileSync(path.join(data.root, data.proof.path), "changed");
    if (defect === "forged-signature") {
      const file = path.join(data.root, data.request.authorization);
      const envelope = JSON.parse(fs.readFileSync(file));
      envelope.signature = Buffer.alloc(64).toString("base64");
      fs.writeFileSync(file, JSON.stringify(envelope));
    }
    if (defect === "trust-tamper") fs.appendFileSync(data.environment.APEX_RISK_TRUST_CONFIG, " ");
    assert.throws(() => evaluateAuthorization(data.request, data.environment));
  });
}
