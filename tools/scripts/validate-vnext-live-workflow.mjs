#!/usr/bin/env node
/** Validate the manual vNext live qualification workflow security contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const WORKFLOW = ".github/workflows/vnext-live-qualification.yml";
const PROTECTED = ["preview", "apply"];
const REQUIRED_VARS = [
  "APEX_CONTROL_RESOURCE_GROUP",
  "APEX_BACKEND_STORAGE_ACCOUNT",
  "APEX_BICEP_RESOURCE_GROUP",
  "APEX_TERRAFORM_RESOURCE_GROUP",
  "APEX_LOG_ANALYTICS_WORKSPACE_RESOURCE_ID",
  "APEX_LOCATION",
  "APEX_PROJECT_NAME",
  "APEX_QUALIFICATION_TAGS_JSON",
];

const steps = (job) => (Array.isArray(job?.steps) ? job.steps : []);
const runs = (job) =>
  steps(job)
    .map((step) => step.run ?? "")
    .join("\n");
const uses = (job) =>
  steps(job)
    .map((step) => step.uses)
    .filter(Boolean);
const index = (text, value) => text.indexOf(value);
const hasExactPermissions = (permissions, expected) =>
  permissions &&
  Object.keys(permissions).length === Object.keys(expected).length &&
  Object.entries(expected).every(([name, access]) => permissions[name] === access);
const hasHiddenPathSegment = (paths) =>
  String(paths)
    .split(/\r?\n/)
    .some((path) =>
      path
        .trim()
        .split(/[\\/]/)
        .some((segment) => segment.startsWith(".") && segment !== "." && segment !== ".."),
    );

export function validateWorkflowText(text) {
  const errors = [];
  let value;
  try {
    value = yaml.load(text);
  } catch (error) {
    return [`YAML parse failed: ${error.message}`];
  }
  const fail = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const triggers = value?.on;
  fail(triggers && Object.keys(triggers).length === 1 && triggers.workflow_dispatch, "workflow must be dispatch-only");
  const inputs = triggers?.workflow_dispatch?.inputs ?? {};
  fail(inputs.track?.type === "choice" && inputs.track.options?.join() === "bicep,terraform", "track choices invalid");
  fail(
    inputs.operation?.type === "choice" && inputs.operation.options?.join() === "apply,destroy",
    "operation choices invalid",
  );
  fail(
    inputs.track?.required === true &&
      inputs.operation?.required === true &&
      inputs.handoff_id?.required === true &&
      inputs.candidate_sha?.required === true,
    "required dispatch inputs missing",
  );
  fail(
    hasExactPermissions(value?.permissions, { contents: "read" }),
    "workflow permissions must be contents read only",
  );
  fail(value?.concurrency?.["cancel-in-progress"] === false, "authority ceremony must not be cancelled in progress");
  const jobs = value?.jobs ?? {};
  fail(
    Object.keys(jobs).join() === "validate_dispatch,preview,apply",
    "exact validate_dispatch, preview, apply jobs required",
  );
  fail(
    hasExactPermissions(jobs.validate_dispatch?.permissions, { contents: "read" }),
    "validate_dispatch permissions must be contents read only",
  );
  fail(jobs.preview?.needs === "validate_dispatch", "preview must need validation");
  fail(jobs.apply?.needs === "preview", "apply must need preview");
  fail(
    jobs.apply?.if === "${{ always() && needs.preview.outputs.artifact_digest != '' }}",
    "apply must continue only after encrypted authority upload",
  );
  fail(
    jobs.preview?.outputs?.artifact_digest === "${{ steps.authority_upload.outputs.artifact-digest }}",
    "authority artifact digest output missing",
  );
  fail(
    jobs.preview?.outputs?.terraform_lock_hash === "${{ steps.provider.outputs.lock_hash }}",
    "preview Terraform lock hash output missing",
  );
  fail(
    jobs.preview?.outputs?.preview_runner_ip === "${{ steps.ip.outputs.address }}",
    "preview runner IP output missing",
  );
  for (const name of ["validate_dispatch", ...PROTECTED]) {
    const checkoutSteps = steps(jobs[name]).filter((step) => step.uses === "actions/checkout@v6");
    fail(
      checkoutSteps.length === 1 &&
        checkoutSteps[0].with?.ref === "${{ inputs.candidate_sha }}" &&
        checkoutSteps[0].with?.["persist-credentials"] === false,
      `${name} checkout must use candidate SHA with persisted credentials disabled`,
    );
  }
  const validation = runs(jobs.validate_dispatch);
  fail(validation.includes("refs/heads/feat/apex-vnext-rewrite"), "branch guard missing");
  fail(validation.includes('GITHUB_RUN_ATTEMPT" = "1'), "attempt-one guard missing");
  fail(
    validation.includes("^[0-9a-f]{40}$") && validation.includes("git rev-parse HEAD"),
    "exact lowercase SHA guard missing",
  );
  fail(uses(jobs.validate_dispatch).includes("actions/checkout@v6"), "validation checkout must use v6");

  for (const name of PROTECTED) {
    const job = jobs[name];
    const script = runs(job);
    const actions = uses(job);
    fail(
      hasExactPermissions(job?.permissions, { contents: "read", "id-token": "write" }),
      `${name} permissions must be contents read and id-token write only`,
    );
    fail(job?.environment === "vnext-qualification", `${name} environment missing`);
    fail(job?.env?.APEX_PLAN_TRANSPORT_KEY === undefined, `${name} transport key must not be job-wide`);
    fail(job?.env?.ARM_OIDC_TOKEN === undefined, `${name} ARM token must not be job-wide`);
    fail(job?.["timeout-minutes"] > 0, `${name} timeout missing`);
    fail(actions.includes("actions/checkout@v6"), `${name} exact checkout action missing`);
    fail(actions.includes("./.github/actions/setup-node-repo"), `${name} setup action missing`);
    fail(actions.includes("azure/login@v3"), `${name} Azure login version invalid`);
    fail(actions.includes("hashicorp/setup-terraform@v3"), `${name} Terraform setup version invalid`);
    fail(actions.includes("actions/github-script@v8"), `${name} OIDC script version invalid`);
    fail(script.includes("git rev-parse HEAD"), `${name} does not verify checked out HEAD`);
    const firewallOpen = steps(job).find((step) => step.name === "Open temporary firewall rule");
    const firewallOpenScript = firewallOpen?.run ?? "";
    fail(
      firewallOpenScript.includes("--security-exception-only") &&
        index(firewallOpenScript, "--security-exception-only") <
          index(firewallOpenScript, "--set tags.SecurityControl=Ignore") &&
        index(firewallOpenScript, "--set tags.SecurityControl=Ignore") <
          index(firewallOpenScript, "--public-network-access Enabled") &&
        index(firewallOpenScript, "--public-network-access Enabled") < index(firewallOpenScript, "network-rule add") &&
        firewallOpenScript.includes("/32"),
      `${name} firewall boundary transaction missing`,
    );
    fail(
      script.includes("storage blob list") && script.includes("for attempt in 1 2 3 4 5"),
      `${name} data-plane readiness probe missing`,
    );
    fail(
      script.includes("sha256sum infra/terraform/vnext-qualification/.terraform.lock.hcl") &&
        (script.includes('= "$lock_hash"') || script.includes('= "$PREVIEW_LOCK_HASH"')),
      `${name} exact Terraform lockfile binding missing`,
    );
    const cleanup = steps(job).find((step) => step.name === "Remove temporary firewall rule");
    fail(
      cleanup?.if === "always()" &&
        cleanup.run?.includes("network-rule remove") &&
        cleanup.run?.includes("--public-network-access Disabled") &&
        cleanup.run?.includes("--remove tags.SecurityControl") &&
        cleanup.run?.includes("securityControl:tags.SecurityControl") &&
        cleanup.run?.includes('!= "Disabled"') &&
        cleanup.run?.includes('-n "$security_control"'),
      `${name} unconditional cleanup missing`,
    );
    fail(
      script.includes("removed:$removed") && script.includes("restored:$restored") && script.includes('exit "$status"'),
      `${name} cleanup evidence/failure missing`,
    );
    for (const variable of REQUIRED_VARS) fail(script.includes(variable), `${name} does not validate ${variable}`);
    fail(
      script
        .split(/\r?\n/)
        .some((line) => line.trim() === "node tools/scripts/validate-vnext-qualification-context.mjs") &&
        script.includes("az account show --query id") &&
        script.includes('= "$AZURE_SUBSCRIPTION_ID"'),
      `${name} exact qualification context validation missing`,
    );
    const jobSteps = steps(job);
    const qualificationValidationIndex = jobSteps.findIndex((step) =>
      step.run
        ?.split(/\r?\n/)
        .some((line) => line.trim() === "node tools/scripts/validate-vnext-qualification-context.mjs"),
    );
    const firewallAddIndex = jobSteps.findIndex((step) => step.run?.includes("network-rule add"));
    fail(
      qualificationValidationIndex >= 0 && firewallAddIndex > qualificationValidationIndex,
      `${name} security exception validation must precede firewall add`,
    );
    const protectedInputs = steps(job).find((step) => step.name === "Validate protected inputs");
    fail(
      protectedInputs?.env?.AZURE_SUBSCRIPTION_ID === "${{ secrets.AZURE_SUBSCRIPTION_ID }}",
      `${name} subscription validation secret missing`,
    );
    const oidc = steps(job).find((step) => step.name === "Acquire ARM OIDC token");
    fail(
      oidc?.id === "arm_oidc" &&
        oidc.uses === "actions/github-script@v8" &&
        oidc.with?.["result-encoding"] === "string" &&
        oidc.with?.script?.includes("return token") &&
        !oidc.with?.script?.includes("exportVariable"),
      `${name} ARM token must be a masked step output`,
    );
    const refreshedOidc = steps(job).find(
      (step) =>
        step.name === (name === "preview" ? "Refresh ARM OIDC token for preview" : "Refresh ARM OIDC token for deploy"),
    );
    const refreshedId = name === "preview" ? "preview_oidc" : "deploy_oidc";
    fail(
      refreshedOidc?.id === refreshedId &&
        refreshedOidc.uses === "actions/github-script@v8" &&
        refreshedOidc.with?.["result-encoding"] === "string" &&
        refreshedOidc.with?.script?.includes("return token"),
      `${name} refreshed ARM token step missing`,
    );
    for (const step of steps(job)) {
      const command = step.run ?? "";
      if (
        /\b(?:state|provider) transfer-(?:import|export)\b|\bpreview --operation\b|\bdeploy --preview\b/.test(command)
      ) {
        fail(
          step.env?.APEX_PLAN_TRANSPORT_KEY === "${{ secrets.APEX_PLAN_TRANSPORT_KEY }}",
          `${name} APEX command lacks step-scoped transport key`,
        );
      }
      if (/terraform -chdir=|\bpreview --operation\b|\bdeploy --preview\b/.test(command)) {
        const expectedToken =
          step.name === "Create exact preview"
            ? "${{ steps.preview_oidc.outputs.result }}"
            : step.name === "Deploy exact preview"
              ? "${{ steps.deploy_oidc.outputs.result }}"
              : "${{ steps.arm_oidc.outputs.result }}";
        fail(step.env?.ARM_OIDC_TOKEN === expectedToken, `${name} Terraform operation lacks step-scoped ARM token`);
      }
    }
  }

  const preview = runs(jobs.preview);
  const apply = runs(jobs.apply);
  const previewJob = JSON.stringify(jobs.preview);
  const applyJob = JSON.stringify(jobs.apply);
  const previewCommand = preview.split("\n").find((line) => line.includes(" preview --operation")) ?? "";
  const previewRecipient = "github-actions:${GITHUB_REPOSITORY}:${GITHUB_RUN_ID}:${GITHUB_RUN_ATTEMPT}:preview";
  const applyRecipient = "github-actions:${GITHUB_REPOSITORY}:${GITHUB_RUN_ID}:${GITHUB_RUN_ATTEMPT}:apply";
  fail(preview.includes(previewRecipient) && preview.includes(applyRecipient), "canonical recipients missing");
  fail(
    preview.includes("state transfer-import") && preview.includes("writer transfer-accept"),
    "preview import/accept missing",
  );
  fail(
    index(preview, "state transfer-import") < index(preview, "writer transfer-accept"),
    "preview must import before accept",
  );
  fail(
    index(preview, "accepted=true") < index(preview, "storage blob delete"),
    "preview acceptance must be durable before incoming blob deletion",
  );
  fail(previewCommand.includes('--recipient "$APPLY_RECIPIENT"'), "preview recipient binding missing");
  fail(preview.includes('test -n "$PREVIEW_HASH"'), "preview hash handoff guard missing");
  fail(
    index(preview, "preview --operation") < index(preview, "writer transfer-create"),
    "writer transfer must follow preview",
  );
  fail(
    preview.includes("provider transfer-export") && preview.includes("state transfer-export"),
    "encrypted authority exports missing",
  );
  fail(
    preview.includes("incoming/${{ inputs.handoff_id }}.json") && preview.includes("storage blob delete"),
    "incoming handoff lifecycle missing",
  );
  fail(
    preview.includes("preview-failure") && previewJob.includes("local:${{ inputs.handoff_id }}"),
    "preview recovery transfer missing",
  );
  const authorityUpload = steps(jobs.preview).find((step) => step.name === "Upload encrypted apply authority");
  const authorityPath = authorityUpload?.with?.path ?? "";
  fail(
    authorityUpload?.uses === "actions/upload-artifact@v4" &&
      authorityPath.includes("authority-state.json") &&
      authorityPath.includes("provider-authority.json") &&
      authorityUpload.with["retention-days"] === 1 &&
      authorityUpload.with["compression-level"] === 0 &&
      authorityUpload.with["include-hidden-files"] === false &&
      authorityUpload.with["if-no-files-found"] === "error",
    "encrypted-only authority artifact invalid",
  );

  fail(apply.includes("state transfer-import") && apply.includes("provider transfer-import"), "apply imports missing");
  const applySteps = steps(jobs.apply);
  const staleRuleCleanup = applySteps.find((step) => step.name === "Clear preview firewall rule");
  fail(
    staleRuleCleanup?.env?.PREVIEW_RUNNER_IP === "${{ needs.preview.outputs.preview_runner_ip }}" &&
      staleRuleCleanup.run?.includes("network-rule remove") &&
      staleRuleCleanup.run?.includes("networkRuleSet.ipRules") &&
      applySteps.indexOf(staleRuleCleanup) <
        applySteps.findIndex((step) => step.name === "Open temporary firewall rule"),
    "apply must clear the preview runner rule before opening its own",
  );
  fail(
    index(apply, "state transfer-import") < index(apply, "provider transfer-import") &&
      index(apply, "provider transfer-import") < index(apply, "writer transfer-accept"),
    "apply import/accept order invalid",
  );
  fail(
    apply.includes("gate decide --gate 4 --decision approved --mechanism github-environment"),
    "Gate 4 mechanism invalid",
  );
  fail(!preview.includes("gate decide --gate 4"), "Gate 4 must only run in apply");
  fail(
    apply.includes('deploy --preview "${{ needs.preview.outputs.preview_hash }}"'),
    "deploy must use exact preview output",
  );
  fail(
    apply.includes("terraform -chdir=infra/terraform/vnext-qualification init"),
    "fresh apply runner Terraform init missing",
  );
  fail(
    applyJob.includes("PREVIEW_LOCK_HASH") &&
      applyJob.includes("needs.preview.outputs.terraform_lock_hash") &&
      apply.includes('test "$lock_hash" = "$PREVIEW_LOCK_HASH"') &&
      apply.includes('= "$PREVIEW_LOCK_HASH"'),
    "apply must bind the exact preview Terraform lock hash",
  );
  fail(
    applyJob.includes("local:${{ inputs.handoff_id }}") && apply.includes("return-authority.json"),
    "return authority transfer missing",
  );
  fail(uses(jobs.apply).includes("actions/download-artifact@v4"), "authority download version invalid");
  fail(
    uses(jobs.apply).filter((action) => action === "actions/upload-artifact@v4").length >= 2,
    "apply artifacts invalid",
  );

  const combined = `${preview}\n${apply}`;
  const forbidden = [
    /terraform\s+(?:-chdir=\S+\s+)?(?:apply|destroy)\b/,
    /az\s+stack\s+group\s+(?:create|delete)\b/,
    /az\s+deployment\s+(?:group|sub)\s+create\b/,
    /gate decide[^\n]*--actor\b/,
  ];
  for (const pattern of forbidden) fail(!pattern.test(combined), `forbidden direct mutation found: ${pattern}`);
  const artifactPaths = steps(jobs.preview)
    .concat(steps(jobs.apply))
    .filter((step) => step.uses === "actions/upload-artifact@v4")
    .map((step) => String(step.with?.path ?? ""))
    .join("\n");
  fail(
    !/(plan-transport\.key|\.tfplan|\.tfstate|\.apex\/|main\.parameters\.json)/.test(artifactPaths),
    "plaintext/key path in artifacts",
  );
  fail(!hasHiddenPathSegment(artifactPaths), "artifact upload path contains a hidden path segment");
  fail(
    !combined.includes("GITHUB_RUN_ATTEMPT -gt") && !combined.includes("GITHUB_RUN_ATTEMPT != 1"),
    "retry rollover allowed",
  );
  return errors;
}

export function validateWorkflowFile(file = WORKFLOW) {
  return validateWorkflowText(readFileSync(resolve(file), "utf8"));
}

function main() {
  const errors = validateWorkflowFile(process.argv[2] ?? WORKFLOW);
  if (errors.length === 0) {
    console.log("✅ vNext live workflow validation passed");
    return;
  }
  for (const error of errors) console.error(`❌ ${error}`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
