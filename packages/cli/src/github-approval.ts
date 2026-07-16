import type { GitHubApprovalContext } from "@apex/contracts";
import { ApexError, EXIT_CODES } from "./errors.js";

const patterns = {
  repository: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
  ref: /^refs\/heads\/[^\s]+$/,
  sha: /^[0-9a-f]{40}$/,
  workflowRef: /^\S+\/\.github\/workflows\/\S+@refs\/\S+$/,
  decimal: /^[1-9][0-9]*$/,
  job: /^[A-Za-z0-9_.-]+$/,
  environment: /^[A-Za-z0-9][A-Za-z0-9_.-]*$/,
  actor: /^[A-Za-z0-9-]+(?:\[bot\])?$/,
} as const;

function required(environment: NodeJS.ProcessEnv, name: string, pattern: RegExp): string {
  const value = environment[name];
  if (value === undefined || !pattern.test(value)) {
    throw new ApexError("APEX_USAGE", `Invalid or missing ${name}`, EXIT_CODES.usage);
  }
  return value;
}

export function githubApprovalContext(environment: NodeJS.ProcessEnv): GitHubApprovalContext {
  if (environment.GITHUB_ACTIONS !== "true") {
    throw new ApexError("APEX_USAGE", "GitHub Environment approval requires GitHub Actions", EXIT_CODES.usage);
  }
  const repository = required(environment, "GITHUB_REPOSITORY", patterns.repository);
  const ref = required(environment, "GITHUB_REF", patterns.ref);
  const sha = required(environment, "GITHUB_SHA", patterns.sha);
  const workflowRef = required(environment, "GITHUB_WORKFLOW_REF", patterns.workflowRef);
  const runId = required(environment, "GITHUB_RUN_ID", patterns.decimal);
  const runAttemptValue = required(environment, "GITHUB_RUN_ATTEMPT", patterns.decimal);
  const job = required(environment, "GITHUB_JOB", patterns.job);
  const actor = required(environment, "GITHUB_ACTOR", patterns.actor);
  const actorId = required(environment, "GITHUB_ACTOR_ID", patterns.decimal);
  const approvalEnvironment = required(environment, "APEX_GITHUB_ENVIRONMENT", patterns.environment);
  const runAttempt = Number(runAttemptValue);
  if (!Number.isSafeInteger(runAttempt)) {
    throw new ApexError("APEX_USAGE", "Invalid or missing GITHUB_RUN_ATTEMPT", EXIT_CODES.usage);
  }
  return {
    repository,
    ref,
    sha,
    workflowRef,
    runId,
    runAttempt,
    job,
    environment: approvalEnvironment,
    actor,
    actorId,
    recipientIdentity: `github-actions:${repository}:${runId}:${runAttempt}:${job}`,
  };
}
