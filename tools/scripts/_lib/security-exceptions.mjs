import fs from "node:fs";
import path from "node:path";

const EXCEPTION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function collectSecurityExceptions(root) {
  const outputRoot = path.join(root, "agent-output");
  if (!fs.existsSync(outputRoot)) return [];
  return fs
    .readdirSync(outputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const manifestPath = path.join(outputRoot, entry.name, "04-governance-constraints.json");
      if (!fs.existsSync(manifestPath)) return [];
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!Array.isArray(manifest.security_exceptions)) return [];
      return manifest.security_exceptions.map((exception) => ({ ...exception, manifestPath }));
    });
}

export function securityExceptionIssues(exceptions, id, control, now = new Date()) {
  const matches = exceptions.filter((exception) => exception?.id === id);
  if (matches.length !== 1) return [`expected exactly one governance exception named ${id}, found ${matches.length}`];
  const exception = matches[0];
  const issues = [];
  if (!EXCEPTION_PATTERN.test(exception.id)) issues.push("exception ID is invalid");
  if (exception.control !== control) issues.push(`exception control must be ${control}`);
  if (typeof exception.reason !== "string" || exception.reason.trim().length < 8) issues.push("reason is missing");
  if (typeof exception.issue_link !== "string" || !/^https:\/\/github\.com\//.test(exception.issue_link)) {
    issues.push("issue_link must be an HTTPS GitHub URL");
  }
  if (!Array.isArray(exception.compensating_controls) || exception.compensating_controls.length === 0) {
    issues.push("compensating_controls are missing");
  }
  const requestedAt = Date.parse(exception.requested_at);
  const expiresAt = Date.parse(exception.expires_at);
  if (!Number.isFinite(requestedAt)) issues.push("requested_at is invalid");
  if (!Number.isFinite(expiresAt)) issues.push("expires_at is invalid");
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) issues.push("exception is expired");
  if (
    Number.isFinite(requestedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt - requestedAt > 90 * 24 * 60 * 60 * 1000
  ) {
    issues.push("exception exceeds the 90-day maximum");
  }
  return issues;
}
