import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { securityExceptionIssues } from "../scripts/_lib/security-exceptions.mjs";

const exception = {
  id: "sandbox-runner-ip",
  control: "public-network-access",
  requested_at: "2026-07-15T12:00:00.000Z",
  expires_at: "2026-07-16T12:00:00.000Z",
  reason: "Allow one ephemeral runner address for a bounded qualification.",
  issue_link: "https://github.com/jonathan-vella/apex/issues/543",
  compensating_controls: ["Default-deny firewall"],
};

test("security exception requires one current matching governance record", () => {
  const now = new Date("2026-07-15T13:00:00.000Z");
  assert.deepEqual(securityExceptionIssues([exception], exception.id, exception.control, now), []);
  assert.match(securityExceptionIssues([], exception.id, exception.control, now)[0], /exactly one/);
  assert.ok(securityExceptionIssues([exception, exception], exception.id, exception.control, now).length > 0);
  assert.ok(securityExceptionIssues([exception], exception.id, "other-control", now).length > 0);
  assert.ok(
    securityExceptionIssues([exception], exception.id, exception.control, new Date(exception.expires_at)).length > 0,
  );
});

test("qualification backend is policy-compliant at rest without broad Azure service bypass", () => {
  const source = readFileSync("infra/bicep/vnext-qualification/bootstrap.bicep", "utf8");
  assert.match(source, /publicNetworkAccess: 'Disabled'/);
  assert.doesNotMatch(source, /SecurityControl/);
  assert.match(source, /bypass: 'Logging, Metrics'/);
  assert.doesNotMatch(source, /bypass: 'AzureServices/);
  assert.match(source, /defaultAction: 'Deny'/);
});
