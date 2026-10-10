#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { computeTreeHash } from "./validate-iac-handoff.mjs";

const schemaPath = fileURLToPath(new URL("../schemas/risk-authorization.schema.json", import.meta.url));
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true });
ajv.addSchema(schema);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const phases = ["before-plan", "before-codegen", "before-deploy", "after-execution", "after-teardown"];
const actionPhase = {
  "plan-complete": 0,
  codegen: 1,
  "code-complete": 1,
  deploy: 2,
  "deployment-complete": 3,
  "teardown-complete": 4,
};
const kitActions = new Set(["plan-complete", "codegen", "code-complete"]);
export const requiredPlanInputs = [
  "04-iac-contract.json",
  "04-policy-property-map.json",
  "04-environment-manifest.json",
  "04-governance-constraints.md",
  "04-governance-constraints.json",
];

function shape(document, kind) {
  const validate = ajv.getSchema(`risk-authorization-v1#/$defs/${kind}`);
  if (!validate(document)) throw new Error(`Invalid ${kind}: ${ajv.errorsText(validate.errors)}`);
}

function instant(value) {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().replace(".000Z", "Z") !== value
  )
    throw new Error("Invalid UTC timestamp");
  return Date.parse(value);
}

function current(document, now) {
  if (
    instant(document.not_before) > now ||
    now >= instant(document.expires_at) ||
    instant(document.not_before) >= instant(document.expires_at)
  )
    throw new Error("Evidence expired or not yet valid");
}

function unique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

export function evaluateAuthorization(request, environment = process.env) {
  const root = fs.realpathSync(request.root);
  const now = Date.now();
  if (!/^[a-zA-Z0-9_-]+$/.test(request.project) || !(request.action in actionPhase))
    throw new Error("Invalid project/action");
  const watched = new Map();
  const read = (target, external = false) => {
    const resolved = path.resolve(root, target);
    let cursor = resolved;
    while (true) {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error("Evidence cannot traverse symlinks");
      if (external && (stat.mode & 0o022) !== 0 && !(stat.isDirectory() && stat.uid === 0 && stat.mode & 0o1000))
        throw new Error("Trust evidence must be protected from group/world writes");
      if (external && stat.uid !== 0 && stat.uid !== process.getuid()) throw new Error("Untrusted file owner");
      const parent = path.dirname(cursor);
      if (cursor === root || parent === cursor) break;
      cursor = parent;
    }
    if (!external && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Evidence escapes workspace");
    let bytes;
    if (fs.lstatSync(resolved).isDirectory() && !external) {
      const entries = [];
      const ignored = new Set([".git", ".terraform", "node_modules", ".venv", "__pycache__"]);
      const collect = (directory) => {
        for (const name of fs.readdirSync(directory).sort()) {
          if (ignored.has(name)) continue;
          const child = path.join(directory, name);
          const stat = fs.lstatSync(child);
          if (stat.isSymbolicLink()) throw new Error("Evidence tree cannot contain symlinks");
          if (stat.isDirectory()) collect(child);
          else entries.push([path.relative(resolved, child).split(path.sep).join("/"), read(child).sha256]);
        }
      };
      collect(resolved);
      if (!entries.length) throw new Error("Evidence tree is empty");
      bytes = Buffer.from(JSON.stringify(entries));
    } else {
      if (!fs.lstatSync(resolved).isFile()) throw new Error("Evidence must be a regular file");
      bytes = fs.readFileSync(resolved);
    }
    const sha256 = digest(bytes);
    if (watched.has(resolved) && watched.get(resolved) !== sha256)
      throw new Error("Evidence changed during evaluation");
    watched.set(resolved, sha256);
    return { bytes, sha256, path: resolved };
  };
  const reference = (ref) => {
    const found = read(ref.path);
    if (found.sha256 !== ref.sha256) throw new Error(`Changed evidence: ${ref.path}`);
    return found;
  };
  const trustPath = environment.APEX_RISK_TRUST_CONFIG;
  const pin = environment.APEX_RISK_TRUST_SHA256;
  if (
    !trustPath ||
    !/^[a-f0-9]{64}$/.test(pin || "") ||
    !path.isAbsolute(trustPath) ||
    path.resolve(trustPath).startsWith(`${root}${path.sep}`)
  )
    throw new Error("External operator-pinned authority trust unavailable");
  const trustFile = read(trustPath, true);
  if (trustFile.sha256 !== pin) throw new Error("Authority trust pin mismatch");
  const trust = JSON.parse(trustFile.bytes);
  shape(trust, "trust");
  current(trust, now);
  const deadlines = [instant(trust.expires_at)];
  unique(
    trust.grants.map((grant) => grant.key_id),
    "authority keys",
  );
  const signed = (target, kind, role, scope) => {
    const file = read(target);
    const envelope = JSON.parse(file.bytes);
    shape(envelope, "envelope");
    const grant = trust.grants.find((entry) => entry.key_id === envelope.key_id);
    if (
      !grant ||
      trust.revoked_keys.includes(envelope.key_id) ||
      !grant.roles.includes(role) ||
      !grant.projects.includes(request.project) ||
      !grant.actions.includes(request.action)
    )
      throw new Error("Approver authority unresolved or revoked");
    current(grant, now);
    if (
      scope?.kind === "deployment" &&
      (!grant.tenants.includes(scope.tenant_id) || !grant.subscriptions.includes(scope.subscription_id))
    )
      throw new Error("Approver lacks tenant/subscription authority");
    const key = createPublicKey(grant.public_key);
    const payload = Buffer.from(envelope.payload, "base64");
    const signature = Buffer.from(envelope.signature, "base64");
    if (
      payload.toString("base64") !== envelope.payload ||
      signature.toString("base64") !== envelope.signature ||
      key.asymmetricKeyType !== "ed25519" ||
      !verify(null, payload, key, signature)
    )
      throw new Error("Forged authorization signature");
    const document = JSON.parse(payload);
    shape(document, kind);
    current(document, now);
    deadlines.push(instant(document.expires_at), instant(grant.expires_at));
    if (
      document.project !== request.project ||
      trust.revoked_ids.includes(document.id) ||
      !document.actions.includes(request.action)
    )
      throw new Error("Wrong project/action or revoked authorization");
    return { document, grant, file };
  };
  const initial = JSON.parse(Buffer.from(JSON.parse(read(request.authorization).bytes).payload, "base64"));
  shape(initial, "authorization");
  const scope = initial.scope;
  if (scope.kind === "kit" && initial.actions.some((action) => !kitActions.has(action)))
    throw new Error("Kit approval cannot authorize deployment");
  if (scope.kind === "kit" && Object.keys(scope).some((field) => !["kind", "environment", "operation"].includes(field)))
    throw new Error("Kit scope cannot fabricate adopter approval");
  if (scope.kind === "deployment") {
    for (const field of [
      "tenant_id",
      "subscription_id",
      "event_id",
      "event_expires_at",
      "cleanup_owner",
      "teardown_due_at",
      "deployment_context",
    ])
      if (!scope[field]) throw new Error(`Deployment scope requires ${field}`);
    if (instant(scope.teardown_due_at) < instant(scope.event_expires_at)) throw new Error("Invalid teardown deadline");
    if (request.action === "deploy" && now >= instant(scope.event_expires_at)) throw new Error("Lab event expired");
    if (!request.context || path.resolve(root, request.context) !== path.resolve(root, scope.deployment_context.path))
      throw new Error("Actual deployment context required");
    const context = JSON.parse(reference(scope.deployment_context).bytes);
    for (const field of ["tenant_id", "subscription_id", "event_id", "environment", "operation"])
      if (context[field] !== scope[field]) throw new Error(`Deployment context mismatch: ${field}`);
    for (const field of ["tree_hash", "inputs_hash", "phase"])
      if (!context[field]) throw new Error(`Deployment context requires ${field}`);
    if (!context.tree || !Array.isArray(context.input_refs) || !context.input_refs.length)
      throw new Error("Actual deployment tree and runtime input references required");
    const treePath = path.relative(root, path.resolve(root, context.tree.path));
    if (
      ![path.join("infra", "bicep", request.project), path.join("infra", "terraform", request.project)].includes(
        treePath,
      ) ||
      !fs.lstatSync(path.resolve(root, treePath)).isDirectory()
    )
      throw new Error("Wrong project IaC tree");
    if (
      computeTreeHash(path.resolve(root, treePath)).value !== context.tree_hash ||
      context.tree.sha256 !== context.tree_hash
    )
      throw new Error("Actual deployment tree changed");
    context.input_refs.forEach(reference);
    unique(
      context.input_refs.map((ref) => path.resolve(root, ref.path)),
      "deployment inputs",
    );
    const inputHash = digest(
      JSON.stringify(
        context.input_refs
          .map((ref) => [path.relative(root, path.resolve(root, ref.path)).split(path.sep).join("/"), ref.sha256])
          .sort((left, right) => left[0].localeCompare(right[0])),
      ),
    );
    if (inputHash !== context.inputs_hash) throw new Error("Actual deployment inputs changed");
  }
  const authorization = signed(
    request.authorization,
    "authorization",
    scope.kind === "kit" ? "kit-maintainer" : "deployment-risk-owner",
    scope,
  );
  const document = authorization.document;
  const preserved = request.preserved_reviews || [];
  unique(
    document.preserved_reviews.map((ref) => path.resolve(root, ref.path)),
    "preserved review references",
  );
  if (
    !isDeepStrictEqual(
      document.preserved_reviews.map((ref) => path.resolve(root, ref.path)).sort(),
      preserved.map((review) => path.resolve(root, review)).sort(),
    )
  )
    throw new Error("Original review preservation coverage differs");
  document.preserved_reviews.forEach(reference);
  if (
    document.authority_evidence !== authorization.grant.authority_evidence ||
    instant(document.issued_at) > now ||
    instant(document.issued_at) > instant(document.not_before)
  )
    throw new Error("Authority evidence or issuance unresolved");
  if (!Array.isArray(request.reviews) || !request.reviews.length) throw new Error("Current review evidence required");
  const expectedReviews = new Map(
    request.reviews.map((review) => [path.resolve(root, review), JSON.parse(read(review).bytes)]),
  );
  unique(
    request.reviews.map((review) => path.resolve(root, review)),
    "reviews",
  );
  unique(
    document.bindings.map((binding) => path.resolve(root, binding.review.path)),
    "review bindings",
  );
  const unresolved = [];
  for (const binding of document.bindings) {
    const reviewFile = reference(binding.review);
    const review = expectedReviews.get(reviewFile.path);
    if (!review) throw new Error("Authorization includes an extra/unselected review");
    const artifact = reference(binding.artifact);
    if (
      artifact.path !== path.resolve(root, review.challenged_artifact) ||
      artifact.sha256 !== review.cache_inputs.artifact_sha ||
      !isDeepStrictEqual(binding.cache_inputs, review.cache_inputs)
    )
      throw new Error("Reviewed artifact/input hashes differ");
    const normalize = (inputs) =>
      inputs
        .map((input) => ({ path: path.resolve(root, input.path), sha256: input.sha256 }))
        .sort((left, right) => left.path.localeCompare(right.path));
    if (!isDeepStrictEqual(normalize(binding.supporting_inputs), normalize(review.supporting_inputs || [])))
      throw new Error("Reviewed supporting inputs differ or lack coverage");
    unique(
      binding.supporting_inputs.map((input) => path.resolve(root, input.path)),
      "supporting inputs",
    );
    binding.supporting_inputs.forEach(reference);
    for (const name of requiredPlanInputs)
      if (
        !binding.supporting_inputs.some(
          (input) => path.resolve(root, input.path) === path.join(root, "agent-output", request.project, name),
        )
      )
        throw new Error(`Plan review lacks supporting coverage: ${name}`);
    const findings = review.findings.filter((finding) => finding.severity === "must_fix");
    unique(
      binding.findings.map((finding) => finding.id),
      "selected findings",
    );
    if (
      !isDeepStrictEqual(
        binding.findings.map((finding) => finding.id).sort(),
        findings.map((finding) => finding.id).sort(),
      )
    )
      throw new Error("Extra or uncovered must-fix finding");
    for (const finding of binding.findings) {
      for (const ref of finding.eligibility_evidence) {
        reference(ref);
        const eligibility = signed(ref.path, "eligibility", "eligibility-reviewer", scope);
        const assessment = eligibility.document;
        if (eligibility.grant.principal === authorization.grant.principal)
          throw new Error("Eligibility must be assessed independently of the accepting owner");
        if (
          assessment.review_sha256 !== binding.review.sha256 ||
          assessment.finding_id !== finding.id ||
          assessment.rule_reference !== finding.rule_reference ||
          assessment.classification !== finding.classification
        )
          throw new Error("Eligibility does not bind the exact finding and rule");
        if (
          assessment.applicable_law ||
          !assessment.technical_deployment_possible ||
          ["law", "technically-impossible", "unresolved"].includes(assessment.classification)
        )
          throw new Error("Non-waivable or unresolved eligibility");
        if (assessment.mandatory_requirement !== (finding.classification === "mandatory-with-exception"))
          throw new Error("Mandatory requirements cannot be relabeled as guidance");
        assessment.source_evidence.forEach(reference);
      }
      if (finding.classification === "mandatory-with-exception") {
        if (!finding.mandatory_exception) throw new Error("Valid rule-authority exception required");
        reference(finding.mandatory_exception);
        const exception = signed(finding.mandatory_exception.path, "exception", "mandatory-exception-owner", scope);
        const permission = exception.document;
        if (
          !exception.grant.rules?.includes(finding.rule_reference) ||
          permission.authority_evidence !== exception.grant.authority_evidence ||
          permission.review_sha256 !== binding.review.sha256 ||
          permission.finding_id !== finding.id ||
          permission.rule_reference !== finding.rule_reference ||
          !isDeepStrictEqual(permission.scope, scope)
        )
          throw new Error("Mandatory exception lacks exact rule/scope authority");
        permission.source_evidence.forEach(reference);
      } else if (finding.mandatory_exception) throw new Error("Unexpected mandatory exception");
      unresolved.push({
        review: binding.review.path,
        id: finding.id,
        severity: "must_fix",
        disposition: "risk-accepted",
        owner: finding.owner,
        residual_impact: finding.residual_impact,
      });
    }
    expectedReviews.delete(reviewFile.path);
  }
  if (
    [...expectedReviews.values()].some((review) => review.findings.some((finding) => finding.severity === "must_fix"))
  )
    throw new Error("Uncovered review findings");
  unique(
    document.obligations.map((obligation) => obligation.id),
    "verification obligations",
  );
  if (
    scope.kind === "deployment" &&
    !document.obligations.some(
      (obligation) => obligation.phase === "after-teardown" && obligation.owner === scope.cleanup_owner,
    )
  )
    throw new Error("Accountable teardown obligation required");
  if (
    scope.kind === "deployment" &&
    ["before-deploy", "after-execution"].some(
      (phase) => !document.obligations.some((obligation) => obligation.phase === phase),
    )
  )
    throw new Error("Deployment requires pre-deploy and post-execution verification obligations");
  let approval;
  let executionStartedAt;
  let canonicalExecution;
  const bindExecution = (ref, observation) => {
    const identity = { path: path.resolve(root, ref.path), sha256: ref.sha256, execution_id: observation.execution_id };
    if (canonicalExecution && !isDeepStrictEqual(canonicalExecution, identity))
      throw new Error("Lifecycle evidence must bind one canonical execution receipt");
    canonicalExecution = identity;
    executionStartedAt = observation.started_at;
  };
  if (request.approval) {
    approval = signed(request.approval, "approval", "human-gate-approver", scope);
    if (
      approval.document.authorization_sha256 !== authorization.file.sha256 ||
      instant(approval.document.approved_at) < instant(document.issued_at) ||
      instant(approval.document.approved_at) > now
    )
      throw new Error("Separate human approval does not bind current authorization");
    unique(
      approval.document.verified_obligations.map((entry) => entry.id),
      "verification evidence",
    );
    for (const entry of approval.document.verified_obligations) {
      if (!document.obligations.some((obligation) => obligation.id === entry.id))
        throw new Error("Unknown verification obligation");
      if (
        phases.indexOf(document.obligations.find((obligation) => obligation.id === entry.id).phase) >
        actionPhase[request.action]
      )
        throw new Error("Post-execution/teardown evidence cannot authorize an earlier action");
      reference(entry.evidence);
      const obligation = document.obligations.find((obligation) => obligation.id === entry.id);
      if (["after-execution", "after-teardown"].includes(obligation.phase)) {
        const validateReceipt = (ref, phase) => {
          reference(ref);
          const receipt = signed(ref.path, "receipt", "lifecycle-verifier", scope);
          const observation = receipt.document;
          if (
            receipt.grant.principal === authorization.grant.principal ||
            observation.phase !== phase ||
            !isDeepStrictEqual(observation.scope, scope) ||
            observation.context_sha256 !== scope.deployment_context.sha256
          )
            throw new Error("Independent event/context-bound lifecycle receipt required");
          const preservedExecution =
            phase === "execution" &&
            request.preserved_execution &&
            path.resolve(root, request.preserved_execution.path) === path.resolve(root, ref.path) &&
            request.preserved_execution.sha256 === ref.sha256 &&
            request.preserved_execution.id === observation.execution_id;
          if (
            (!preservedExecution && instant(observation.started_at) < instant(document.issued_at)) ||
            instant(observation.finished_at) <= instant(observation.started_at) ||
            instant(observation.observed_at) < instant(observation.finished_at) ||
            instant(observation.observed_at) > now ||
            instant(approval.document.approved_at) < instant(observation.observed_at)
          )
            throw new Error("Human completion approval and observations must follow actual execution");
          observation.source_evidence.forEach(reference);
          return observation;
        };
        const observation = validateReceipt(
          entry.evidence,
          obligation.phase === "after-execution" ? "execution" : "teardown",
        );
        if (observation.phase === "teardown") {
          if (!observation.prior_execution) throw new Error("Teardown receipt requires prior execution evidence");
          const execution = validateReceipt(observation.prior_execution, "execution");
          if (
            execution.execution_id !== observation.execution_id ||
            instant(observation.started_at) < instant(execution.finished_at)
          )
            throw new Error("Teardown must follow the bound execution event");
          bindExecution(observation.prior_execution, execution);
        } else bindExecution(entry.evidence, observation);
      }
    }
    for (const obligation of document.obligations)
      if (
        phases.indexOf(obligation.phase) <= actionPhase[request.action] &&
        !approval.document.verified_obligations.some((entry) => entry.id === obligation.id)
      )
        throw new Error(`Required verification missing: ${obligation.id}`);
  } else if (request.require_approval) throw new Error("Separate human gate approval required");
  return {
    schema_version: "risk-evaluation-v1",
    status: "exception-authorized",
    action: request.action,
    scope,
    unresolved_findings: unresolved,
    authorization: {
      path: path.relative(root, authorization.file.path),
      sha256: authorization.file.sha256,
      id: document.id,
    },
    approval: approval
      ? { path: path.relative(root, approval.file.path), sha256: approval.file.sha256, id: approval.document.id }
      : null,
    execution_started_at: executionStartedAt || null,
    execution: canonicalExecution
      ? {
          path: path.relative(root, canonicalExecution.path),
          sha256: canonicalExecution.sha256,
          id: canonicalExecution.execution_id,
        }
      : null,
    valid_until: new Date(
      Math.min(...deadlines, request.action === "deploy" ? instant(scope.event_expires_at) : Infinity),
    ).toISOString(),
    watched_inputs: [...watched].map(([input, sha256]) => ({ path: input, sha256 })),
  };
}

export function main() {
  try {
    console.log(JSON.stringify(evaluateAuthorization(JSON.parse(fs.readFileSync(0, "utf8")))));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ status: "blocked", error: error.message }));
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
