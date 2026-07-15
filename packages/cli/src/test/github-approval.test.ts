import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import type { DeploymentPreviewV1, GitHubApprovalContext } from "@apex/contracts";
import { execute } from "../cli.js";
import { githubApprovalContext } from "../github-approval.js";
import { ApexService, type GateDecisionOptions } from "../service.js";
import { prepareValidatedRun, tempRoot } from "./helpers.js";

const instant = new Date("2026-07-15T10:00:00.000Z");
const repository = "owner/repo";
const branch = "main";
const commit = "a".repeat(40);
const workflowRef = "owner/repo/.github/workflows/deploy.yml@refs/heads/main";

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: repository,
    GITHUB_REF: `refs/heads/${branch}`,
    GITHUB_SHA: commit,
    GITHUB_WORKFLOW_REF: workflowRef,
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_JOB: "deploy",
    GITHUB_ACTOR: "octocat",
    GITHUB_ACTOR_ID: "42",
    APEX_GITHUB_ENVIRONMENT: "production",
    ...overrides,
  };
}

function context(overrides: Partial<GitHubApprovalContext> = {}): GitHubApprovalContext {
  return { ...githubApprovalContext(environment()), ...overrides };
}

async function transferredService(
  clock: () => Date = () => instant,
  previewTtlMs = 1_000,
): Promise<{
  root: string;
  runId: string;
  service: ApexService;
  githubContext: GitHubApprovalContext;
  preview: DeploymentPreviewV1;
}> {
  const root = await tempRoot();
  const service = new ApexService(root, { clock });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const githubContext = context();
  const transfer = (await service.createWriterTransfer({
    repository,
    branch,
    commit,
    workflowId: workflowRef,
    approvalEnvironment: githubContext.environment,
    sender: "local",
    recipient: githubContext.recipientIdentity,
    currentHead: commit,
    ttlMs: 60_000,
  })) as { hash: string };
  await service.acceptWriterTransfer(transfer.hash, githubContext.recipientIdentity, commit);
  const preview = await service.preview({ operation: "apply", provider: "fake", expiresInMs: previewTtlMs });
  return { root, runId: initialized.runId, service, githubContext, preview };
}

test("githubApprovalContext rejects local, missing, and malformed process context without echoing values", () => {
  assert.throws(() => githubApprovalContext({}), /requires GitHub Actions/);
  assert.throws(() => githubApprovalContext(environment({ GITHUB_ACTIONS: "false" })), /requires GitHub Actions/);
  for (const [name, value] of [
    ["GITHUB_REPOSITORY", "owner/repo/extra"],
    ["GITHUB_REF", "main"],
    ["GITHUB_SHA", "A".repeat(40)],
    ["GITHUB_WORKFLOW_REF", "workflow.yml"],
    ["GITHUB_RUN_ID", "12x"],
    ["GITHUB_RUN_ATTEMPT", "0"],
    ["GITHUB_JOB", "deploy job"],
    ["GITHUB_ACTOR", "bad actor"],
    ["GITHUB_ACTOR_ID", "id-42"],
    ["APEX_GITHUB_ENVIRONMENT", "prod env"],
  ] as const) {
    assert.throws(
      () => githubApprovalContext(environment({ [name]: value })),
      (error: unknown) => error instanceof Error && error.message.includes(name) && !error.message.includes(value),
    );
  }
});

test("githubApprovalContext derives the canonical recipient from GitHub Actions variables", () => {
  assert.deepEqual(githubApprovalContext(environment()), {
    repository,
    ref: `refs/heads/${branch}`,
    sha: commit,
    workflowRef,
    runId: "123",
    runAttempt: 2,
    job: "deploy",
    environment: "production",
    actor: "octocat",
    actorId: "42",
    recipientIdentity: "github-actions:owner/repo:123:2:deploy",
  });
});

test("gate decide rejects unsupported mechanisms and a supplied GitHub actor", async () => {
  const root = await tempRoot();
  await assert.rejects(
    execute(["gate", "decide", "--gate", "4", "--decision", "approved", "--mechanism", "inherited"], root),
    /mechanism must be tty or github-environment/,
  );
  await assert.rejects(
    execute(
      [
        "gate",
        "decide",
        "--gate",
        "4",
        "--decision",
        "approved",
        "--mechanism",
        "github-environment",
        "--actor",
        "spoofed",
      ],
      root,
    ),
    /--actor is not accepted/,
  );
});

test("writer transfer-create binds the optional approval environment", async () => {
  const root = await tempRoot();
  await execute(["init", "--project", "demo"], root);
  const transfer = (await execute(
    [
      "writer",
      "transfer-create",
      "--repo",
      repository,
      "--branch",
      branch,
      "--commit",
      commit,
      "--workflow",
      workflowRef,
      "--sender",
      "local",
      "--recipient",
      "ci",
      "--environment",
      "vnext-qualification",
      "--head",
      commit,
      "--ttl",
      "60000",
    ],
    root,
  )) as { claim: { approvalEnvironment?: string } };
  assert.equal(transfer.claim.approvalEnvironment, "vnext-qualification");
});

test("GitHub Environment Gate 4 approval binds accepted ownership and preview expiry", async () => {
  const { service, githubContext, preview } = await transferredService();
  const approval = await service.decideGateNumber(4, "approved", "github:42:octocat", {
    mechanism: "github-environment",
    githubContext,
  });
  assert.equal(approval.mechanism, "github-environment");
  assert.deepEqual(approval.githubContext, githubContext);
  assert.equal(approval.expiresAt, preview.expiresAt);
  assert.ok(Date.parse(approval.expiresAt!) <= Date.parse(preview.expiresAt));
});

test("GitHub Environment Gate 4 approval rejects an expired preview without recording a decision", async () => {
  let now = instant.getTime();
  const { service } = await transferredService(() => new Date(now), 1);
  now += 2;
  await assert.rejects(
    service.decideGateNumber(4, "approved", "github:42:octocat", {
      mechanism: "github-environment",
      githubContext: context(),
    }),
    /preview has expired/,
  );
  assert.equal((await service.status()).run.gates[3]?.state, "open");
});

test("gate decide derives actor and context only from the GitHub Actions process environment", async () => {
  const fixture = await transferredService(() => new Date(), 60_000);
  const source = environment();
  const saved = Object.fromEntries(Object.keys(source).map((name) => [name, process.env[name]]));
  Object.assign(process.env, source);
  try {
    const approval = await execute(
      ["gate", "decide", "--gate", "4", "--decision", "approved", "--mechanism", "github-environment"],
      fixture.root,
    );
    assert.equal((approval as { actor?: unknown }).actor, "github:42:octocat");
    assert.deepEqual((approval as { githubContext?: unknown }).githubContext, fixture.githubContext);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("GitHub Environment approval rejects wrong gate, decision, actor, context, recipient, and schema", async () => {
  const { service, githubContext } = await transferredService();
  const decide = (gate: number, decision: "approved" | "rejected", actor: string, value?: GitHubApprovalContext) =>
    service.decideGateNumber(gate, decision, actor, {
      mechanism: "github-environment",
      ...(value === undefined ? {} : { githubContext: value }),
    });
  await assert.rejects(decide(3, "approved", "github:42:octocat", githubContext), /limited to approved Gate 4/);
  await assert.rejects(decide(4, "rejected", "github:42:octocat", githubContext), /limited to approved Gate 4/);
  await assert.rejects(decide(4, "approved", "github:99:octocat", githubContext), /actor/);
  await assert.rejects(decide(4, "approved", "github:42:octocat"), /requires context/);
  for (const changed of [
    context({ repository: "other/repo" }),
    context({ ref: "refs/heads/other" }),
    context({ sha: "b".repeat(40) }),
    context({ workflowRef: "owner/repo/.github/workflows/other.yml@refs/heads/main" }),
    context({ environment: "other" }),
  ]) {
    await assert.rejects(decide(4, "approved", "github:42:octocat", changed), /recipient|ownership/);
  }
  await assert.rejects(
    decide(4, "approved", "github:42:octocat", context({ recipientIdentity: "github-actions:other" })),
    /recipient/,
  );
  await assert.rejects(decide(4, "approved", "github:42:octocat", context({ runAttempt: 0 })), /approval validation/i);
});

test("GitHub Environment approval rejects missing, stale, and mismatched writer ownership", async () => {
  const root = await tempRoot();
  const missing = new ApexService(root, { clock: () => instant });
  const initialized = await missing.init({ projectId: "demo" });
  await prepareValidatedRun(missing, initialized.runId, "bicep");
  await missing.preview({ operation: "apply", provider: "fake" });
  await assert.rejects(
    missing.decideGateNumber(4, "approved", "github:42:octocat", {
      mechanism: "github-environment",
      githubContext: context(),
    }),
    /ownership is missing or stale/,
  );

  for (const mutation of [
    (ownership: Record<string, unknown>) => ({ ...ownership, ownerId: "github-actions:other" }),
    (ownership: Record<string, unknown>) => ({ ...ownership, ownerEpoch: 999 }),
    (ownership: Record<string, unknown>) => {
      const changed = { ...ownership };
      delete changed.approvalEnvironment;
      return changed;
    },
  ]) {
    const fixture = await transferredService();
    const ownershipPath = join(fixture.root, ".apex", "projects", "demo", "runs", fixture.runId, "ownership.json");
    const ownership = JSON.parse(await readFile(ownershipPath, "utf8")) as Record<string, unknown>;
    await writeFile(ownershipPath, `${JSON.stringify(mutation(ownership))}\n`, "utf8");
    await assert.rejects(
      fixture.service.decideGateNumber(4, "approved", "github:42:octocat", {
        mechanism: "github-environment",
        githubContext: fixture.githubContext,
      }),
      /recipient|ownership is missing or stale|context does not match writer ownership/,
    );
  }
});

test("TTY remains the default, forbids GitHub context, and uses preview expiry", async () => {
  const service = new ApexService(await tempRoot(), { clock: () => instant });
  const initialized = await service.init({ projectId: "demo" });
  await prepareValidatedRun(service, initialized.runId, "bicep");
  const preview = await service.preview({ operation: "apply", provider: "fake", expiresInMs: 2_000 });
  const approval = await service.decideGateNumber(4, "approved", "tester");
  assert.equal(approval.mechanism, "tty");
  assert.equal("githubContext" in approval, false);
  assert.equal(approval.expiresAt, preview.expiresAt);

  const second = await transferredService();
  await assert.rejects(
    second.service.decideGateNumber(4, "approved", "tester", {
      mechanism: "inherited",
    } as unknown as GateDecisionOptions),
    /Unsupported gate approval mechanism/,
  );
  await assert.rejects(
    second.service.decideGateNumber(4, "approved", "tester", { githubContext: second.githubContext }),
    /cannot include GitHub context/,
  );
});
