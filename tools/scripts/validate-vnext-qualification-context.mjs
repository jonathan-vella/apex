#!/usr/bin/env node
/** Validate non-secret Azure inputs for the vNext qualification sandbox. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { securityExceptionIssues } from "./_lib/security-exceptions.mjs";

export const FIREWALL_EXCEPTION_ID = "vnext-qualification-backend-runner-ip";
export const FIREWALL_SESSION_MINIMUM_REMAINING_MINUTES = 75;
const FIREWALL_EXCEPTION_CONTROL = "public-network-access";
const FIREWALL_EXCEPTION_ENVIRONMENT = "vnext-qualification";
const FIREWALL_EXCEPTION_WORKLOAD = "terraform-backend";
const FIREWALL_EXCEPTION_MAXIMUM_HOURS = 24;

export const EXPECTED_TAGS = Object.freeze({
  environment: "qualification",
  owner: "jonathan-vella",
  costcenter: "platform-engineering",
  application: "apex",
  workload: "vnext-qualification",
  sla: "development",
  "backup-policy": "none",
  "maint-window": "none",
  "technical-contact": "jonathan-vella",
  "tech-contact": "jonathan-vella",
});

function parseTags(value) {
  try {
    const tags = JSON.parse(value ?? "");
    return tags !== null && typeof tags === "object" && !Array.isArray(tags) ? tags : null;
  } catch {
    return null;
  }
}

function canonicalObject(value) {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

export function qualificationSecurityExceptionIssues(
  governance,
  now = new Date(),
  minimumRemainingMilliseconds = FIREWALL_SESSION_MINIMUM_REMAINING_MINUTES * 60 * 1000,
) {
  const exceptions = Array.isArray(governance?.security_exceptions) ? governance.security_exceptions : [];
  const issues = securityExceptionIssues(exceptions, FIREWALL_EXCEPTION_ID, FIREWALL_EXCEPTION_CONTROL, now);
  const matches = exceptions.filter((exception) => exception?.id === FIREWALL_EXCEPTION_ID);
  if (matches.length !== 1) return issues;
  const exception = matches[0];
  if (exception.scope?.environment !== FIREWALL_EXCEPTION_ENVIRONMENT) {
    issues.push(`exception scope.environment must be ${FIREWALL_EXCEPTION_ENVIRONMENT}`);
  }
  if (exception.scope?.workload !== FIREWALL_EXCEPTION_WORKLOAD) {
    issues.push(`exception scope.workload must be ${FIREWALL_EXCEPTION_WORKLOAD}`);
  }
  const maximumHours = exception.scope?.maximum_lifetime_hours;
  if (!Number.isFinite(maximumHours) || maximumHours <= 0 || maximumHours > FIREWALL_EXCEPTION_MAXIMUM_HOURS) {
    issues.push(`exception maximum_lifetime_hours must be at most ${FIREWALL_EXCEPTION_MAXIMUM_HOURS}`);
  }
  const endpointLifecycle = exception.endpoint_lifecycle;
  const expectedOpenSequence = [
    "validate-exception",
    "add-transient-policy-exclusion",
    "enable-public-network-access",
    "add-ephemeral-/32",
  ];
  const expectedCleanupSequence = [
    "remove-ephemeral-/32",
    "disable-public-network-access",
    "remove-transient-policy-exclusion",
    "verify-disabled-and-exclusion-absent",
  ];
  if (endpointLifecycle?.at_rest_public_network_access !== "Disabled") {
    issues.push("exception endpoint lifecycle must keep public network access Disabled at rest");
  }
  if (
    endpointLifecycle?.policy_exclusion?.tag_name !== "SecurityControl" ||
    endpointLifecycle?.policy_exclusion?.tag_value !== "Ignore" ||
    endpointLifecycle?.policy_exclusion?.persistence !== "session-only"
  ) {
    issues.push("exception endpoint lifecycle must bind the session-only SecurityControl exclusion");
  }
  if (endpointLifecycle?.minimum_remaining_minutes !== FIREWALL_SESSION_MINIMUM_REMAINING_MINUTES) {
    issues.push(`exception endpoint lifecycle must require ${FIREWALL_SESSION_MINIMUM_REMAINING_MINUTES} minutes`);
  }
  if (JSON.stringify(endpointLifecycle?.open_sequence) !== JSON.stringify(expectedOpenSequence)) {
    issues.push("exception endpoint open sequence is invalid");
  }
  if (JSON.stringify(endpointLifecycle?.cleanup_sequence) !== JSON.stringify(expectedCleanupSequence)) {
    issues.push("exception endpoint cleanup sequence is invalid");
  }
  const requestedAt = Date.parse(exception.requested_at);
  const expiresAt = Date.parse(exception.expires_at);
  if (Number.isFinite(requestedAt) && requestedAt > now.getTime()) issues.push("exception is not active yet");
  if (Number.isFinite(expiresAt) && expiresAt - now.getTime() <= minimumRemainingMilliseconds) {
    issues.push(`exception has less than ${FIREWALL_SESSION_MINIMUM_REMAINING_MINUTES} minutes remaining`);
  }
  if (
    Number.isFinite(requestedAt) &&
    Number.isFinite(expiresAt) &&
    (expiresAt <= requestedAt || expiresAt - requestedAt > FIREWALL_EXCEPTION_MAXIMUM_HOURS * 60 * 60 * 1000)
  ) {
    issues.push(`exception lifetime must be positive and at most ${FIREWALL_EXCEPTION_MAXIMUM_HOURS} hours`);
  }
  return issues;
}

export function qualificationContextIssues(environment, governance, now = new Date()) {
  const issues = [];
  const expectedSubscription = governance?.subscription_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedSubscription ?? "")) {
    issues.push("governance subscription_id is invalid");
  }
  const expected = {
    APEX_PROJECT_NAME: "vnext",
    APEX_LOCATION: "swedencentral",
    APEX_CONTROL_RESOURCE_GROUP: "rg-vnext-qualification-control",
    APEX_BICEP_RESOURCE_GROUP: "rg-vnext-qualification-bicep",
    APEX_TERRAFORM_RESOURCE_GROUP: "rg-vnext-qualification-terraform",
    AZURE_SUBSCRIPTION_ID: expectedSubscription,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (environment[name] !== value) issues.push(`${name} does not match the qualification contract`);
  }
  if (!/^stvnexttf[a-z0-9]{6}$/.test(environment.APEX_BACKEND_STORAGE_ACCOUNT ?? "")) {
    issues.push("APEX_BACKEND_STORAGE_ACCOUNT does not match the bootstrap naming contract");
  }
  const workspace = `/subscriptions/${expectedSubscription}/resourceGroups/rg-vnext-qualification-control/providers/Microsoft.OperationalInsights/workspaces/log-vnext-qualification`;
  if (environment.APEX_LOG_ANALYTICS_WORKSPACE_RESOURCE_ID?.toLowerCase() !== workspace.toLowerCase()) {
    issues.push("APEX_LOG_ANALYTICS_WORKSPACE_RESOURCE_ID does not match the bootstrap output contract");
  }
  const tags = parseTags(environment.APEX_QUALIFICATION_TAGS_JSON);
  if (tags === null || canonicalObject(tags) !== canonicalObject(EXPECTED_TAGS)) {
    issues.push("APEX_QUALIFICATION_TAGS_JSON does not match the approved ten-tag contract");
  }
  issues.push(...qualificationSecurityExceptionIssues(governance, now));
  return issues;
}

export function validateQualificationContext(
  environment = process.env,
  governanceFile = "agent-output/vnext-qualification/04-governance-constraints.json",
  now = new Date(),
) {
  const governance = JSON.parse(readFileSync(resolve(governanceFile), "utf8"));
  return qualificationContextIssues(environment, governance, now);
}

export function validateQualificationSecurityException(
  governanceFile = "agent-output/vnext-qualification/04-governance-constraints.json",
  now = new Date(),
) {
  const governance = JSON.parse(readFileSync(resolve(governanceFile), "utf8"));
  return qualificationSecurityExceptionIssues(governance, now);
}

function main() {
  const exceptionOnly = process.argv[2] === "--security-exception-only";
  const governanceFile = exceptionOnly ? process.argv[3] : process.argv[2];
  const issues = exceptionOnly
    ? validateQualificationSecurityException(governanceFile)
    : validateQualificationContext(process.env, governanceFile);
  if (issues.length === 0) return;
  for (const issue of issues) console.error(`Qualification context invalid: ${issue}`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
