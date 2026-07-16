import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalRecipient,
  isAcceptedLocalOwnership,
  parseArgs,
  validateDispatchRunState,
  validateTransportKey,
  validateWorkflowBootstrap,
  withFirewall,
  workflowRef,
} from "../scripts/vnext-live-handoff.mjs";
import { validateWorkflowText } from "../scripts/validate-vnext-live-workflow.mjs";

const baseline = readFileSync(new URL("../../.github/workflows/vnext-live-qualification.yml", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../scripts/vnext-live-handoff.mjs", import.meta.url), "utf8");

function rejectsMutation(name, mutate, expected) {
  test(name, () => {
    const errors = validateWorkflowText(mutate(baseline));
    assert.ok(
      errors.some((error) => error.includes(expected)),
      errors.join("\n"),
    );
  });
}

test("baseline live workflow passes", () => assert.deepEqual(validateWorkflowText(baseline), []));

rejectsMutation(
  "missing protected environment fails",
  (text) => text.replace("    environment: vnext-qualification\n", ""),
  "preview environment",
);
rejectsMutation(
  "missing id-token permission fails",
  (text) => text.replace("      id-token: write\n", ""),
  "id-token write",
);
rejectsMutation(
  "workflow-level id-token permission fails",
  (text) => text.replace("permissions:\n  contents: read\n", "permissions:\n  contents: read\n  id-token: write\n"),
  "workflow permissions must be contents read only",
);
rejectsMutation(
  "missing authority digest output fails",
  (text) => text.replace("      artifact_digest: ${{ steps.authority_upload.outputs.artifact-digest }}\n", ""),
  "artifact digest output",
);
rejectsMutation(
  "missing preview lock hash output fails",
  (text) => text.replace("      terraform_lock_hash: ${{ steps.provider.outputs.lock_hash }}\n", ""),
  "preview Terraform lock hash output",
);
rejectsMutation(
  "missing preview runner IP cleanup fails",
  (text) => text.replace("      - name: Clear preview firewall rule", "      - name: Missing preview firewall cleanup"),
  "clear the preview runner rule",
);
rejectsMutation(
  "job-wide transport key fails",
  (text) =>
    text.replace(
      "      APEX_CONTROL_RESOURCE_GROUP: ${{ vars.APEX_CONTROL_RESOURCE_GROUP }}",
      "      APEX_PLAN_TRANSPORT_KEY: ${{ secrets.APEX_PLAN_TRANSPORT_KEY }}\n      APEX_CONTROL_RESOURCE_GROUP: ${{ vars.APEX_CONTROL_RESOURCE_GROUP }}",
    ),
  "transport key must not be job-wide",
);
rejectsMutation(
  "exported ARM token fails",
  (text) => text.replace("            return token;", '            core.exportVariable("ARM_OIDC_TOKEN", token);'),
  "masked step output",
);
rejectsMutation(
  "missing refreshed preview ARM token fails",
  (text) => text.replace("      - name: Refresh ARM OIDC token for preview", "      - name: Missing preview token"),
  "refreshed ARM token",
);
rejectsMutation(
  "missing data-plane readiness fails",
  (text) => text.replace("az storage blob list --auth-mode login", "az storage container list --auth-mode login"),
  "readiness probe",
);
rejectsMutation(
  "missing exact qualification context validation fails",
  (text) => text.replace("node tools/scripts/validate-vnext-qualification-context.mjs", "node -e 'process.exit(0)'"),
  "exact qualification context",
);
rejectsMutation(
  "qualification validation after firewall opening fails",
  (text) => {
    const validation = "          node tools/scripts/validate-vnext-qualification-context.mjs\n";
    const firewall =
      '          az storage account network-rule add --resource-group "$APEX_CONTROL_RESOURCE_GROUP" --account-name "$APEX_BACKEND_STORAGE_ACCOUNT" --ip-address "${{ steps.ip.outputs.address }}/32" --only-show-errors --output none\n';
    return text.replace(validation, "").replace(firewall, `${firewall}${validation}`);
  },
  "preview security exception validation must precede firewall add",
);
rejectsMutation(
  "missing firewall boundary exception recheck fails",
  (text) =>
    text.replace(
      "          node tools/scripts/validate-vnext-qualification-context.mjs --security-exception-only\n",
      "",
    ),
  "preview firewall boundary transaction",
);
rejectsMutation(
  "missing transient policy exclusion fails",
  (text) =>
    text.replace(
      '          az storage account update --resource-group "$APEX_CONTROL_RESOURCE_GROUP" --name "$APEX_BACKEND_STORAGE_ACCOUNT" --set tags.SecurityControl=Ignore --only-show-errors --output none\n',
      "",
    ),
  "preview firewall boundary transaction",
);
rejectsMutation(
  "missing endpoint disable cleanup fails",
  (text) =>
    text.replace(
      '          az storage account update --resource-group "$APEX_CONTROL_RESOURCE_GROUP" --name "$APEX_BACKEND_STORAGE_ACCOUNT" --public-network-access Disabled --only-show-errors --output none\n',
      "",
    ),
  "preview unconditional cleanup",
);
rejectsMutation(
  "missing policy exclusion cleanup fails",
  (text) =>
    text.replace(
      '          az storage account update --resource-group "$APEX_CONTROL_RESOURCE_GROUP" --name "$APEX_BACKEND_STORAGE_ACCOUNT" --remove tags.SecurityControl --only-show-errors --output none\n',
      "",
    ),
  "preview unconditional cleanup",
);
rejectsMutation(
  "apply skip after preview cleanup failure fails",
  (text) => text.replace("    if: ${{ always() && needs.preview.outputs.artifact_digest != '' }}\n", ""),
  "apply must continue",
);
rejectsMutation(
  "missing unconditional cleanup fails",
  (text) =>
    text.replace(
      "      - name: Remove temporary firewall rule\n        if: always()",
      "      - name: Remove temporary firewall rule",
    ),
  "unconditional cleanup",
);
rejectsMutation(
  "late preview acceptance signal fails",
  (text) =>
    text.replace(
      /(^\s+printf 'accepted=true\\ninitial_claim_hash=%s\\n'.*\n)([\s\S]*?^\s+az storage blob delete.*\n)/m,
      "$2$1",
    ),
  "acceptance must be durable",
);
rejectsMutation(
  "deploy without exact preview fails",
  (text) => text.replace('deploy --preview "${{ needs.preview.outputs.preview_hash }}"', "deploy"),
  "exact preview",
);
rejectsMutation(
  "wrong Gate mechanism fails",
  (text) => text.replace("--mechanism github-environment", "--mechanism tty"),
  "Gate 4 mechanism",
);
rejectsMutation(
  "missing preview recipient fails",
  (text) =>
    text.replace(
      ' --recipient "$APPLY_RECIPIENT" --provider-config apex-live/provider-config.json',
      " --provider-config apex-live/provider-config.json",
    ),
  "preview recipient binding",
);
rejectsMutation(
  "missing preview hash guard fails",
  (text) => text.replace('          test -n "$PREVIEW_HASH"\n', ""),
  "preview hash handoff guard",
);
rejectsMutation(
  "missing apply lock binding fails",
  (text) => text.replace('            test "$lock_hash" = "$PREVIEW_LOCK_HASH"\n', ""),
  "exact preview Terraform lock hash",
);
rejectsMutation(
  "missing provider transfer fails",
  (text) => text.replace("provider transfer-export", "provider authority-export"),
  "encrypted authority exports",
);
rejectsMutation(
  "direct terraform apply fails",
  (text) =>
    text.replace(
      "terraform -chdir=infra/terraform/vnext-qualification init -input=false",
      "terraform -chdir=infra/terraform/vnext-qualification apply -auto-approve",
    ),
  "forbidden direct mutation",
);
rejectsMutation(
  "key path artifact fails",
  (text) =>
    text.replace(
      "apex-live/provider-authority.json\n          retention-days",
      "apex-live/provider-authority.json\n            .apex/local/provider-runtime/plan-transport.key\n          retention-days",
    ),
  "plaintext/key path",
);
rejectsMutation(
  "state path artifact fails",
  (text) =>
    text.replace(
      "apex-live/provider-authority.json\n          retention-days",
      "apex-live/provider-authority.json\n            terraform.tfstate\n          retention-days",
    ),
  "plaintext/key path",
);
rejectsMutation(
  "plain plan path artifact fails",
  (text) =>
    text.replace(
      "apex-live/provider-authority.json\n          retention-days",
      "apex-live/provider-authority.json\n            qualification.tfplan\n          retention-days",
    ),
  "plaintext/key path",
);
rejectsMutation(
  "hidden artifact parent fails",
  (text) =>
    text.replace("            apex-live/provider-authority.json", "            .apex-live/provider-authority.json"),
  "hidden path segment",
);
rejectsMutation(
  "wrong checkout action version fails",
  (text) => text.replace("actions/checkout@v6", "actions/checkout@v5"),
  "checkout must use v6",
);
rejectsMutation(
  "wrong checkout ref fails",
  (text) => text.replace("          ref: ${{ inputs.candidate_sha }}", "          ref: refs/heads/main"),
  "candidate SHA",
);
rejectsMutation(
  "persisted checkout credentials fail",
  (text) => text.replace("          persist-credentials: false", "          persist-credentials: true"),
  "persisted credentials disabled",
);
rejectsMutation(
  "run-attempt rollover allowance fails",
  (text) => text.replace('test "$GITHUB_RUN_ATTEMPT" = "1"', 'test "$GITHUB_RUN_ATTEMPT" -gt "0"'),
  "attempt-one guard",
);

test("launcher derives canonical GitHub identities", () => {
  assert.equal(canonicalRecipient("owner/repo", "42", 1, "preview"), "github-actions:owner/repo:42:1:preview");
  assert.equal(
    workflowRef("owner/repo", "feat/apex-vnext-rewrite"),
    "owner/repo/.github/workflows/vnext-live-qualification.yml@refs/heads/feat/apex-vnext-rewrite",
  );
  assert.throws(() => canonicalRecipient("owner/repo", "42", 2, "preview"));
});

test("launcher validates the exception before opening its local firewall rule", () => {
  const helper = launcher.slice(
    launcher.indexOf("async function withFirewall"),
    launcher.indexOf("async function discoverRun"),
  );
  assert.ok(helper.lastIndexOf("assertException()") < helper.indexOf('"network-rule", "add"'));
  assert.ok(helper.indexOf('"tags.SecurityControl=Ignore"') < helper.indexOf('"--public-network-access"'));
  assert.ok(helper.indexOf('"public-network-access",\n    "Enabled"') < helper.indexOf('"network-rule", "add"'));
  assert.ok(helper.lastIndexOf('"--public-network-access"') > helper.indexOf('"network-rule", "remove"'));
  assert.ok(helper.lastIndexOf('"tags.SecurityControl"') > helper.indexOf('"network-rule", "remove"'));
  assert.ok(helper.lastIndexOf('"Disabled"') > helper.indexOf('"network-rule", "remove"'));
});

test("launcher rejects an exception that expires while resolving its public IP", async () => {
  let validation = 0;
  const commands = [];
  await assert.rejects(
    withFirewall(
      {
        resource_group: "control-rg",
        storage_account: "storage",
        container: "handoff",
      },
      async () => undefined,
      {
        validateException: () => (++validation === 1 ? [] : ["exception is expired"]),
        publicIpv4: async () => "203.0.113.10",
        run: async (file, args) => commands.push([file, ...args]),
      },
    ),
    /exception is invalid/,
  );
  assert.deepEqual(commands, []);
});

test("launcher restores and verifies Disabled after a local firewall session", async () => {
  const commands = [];
  const result = await withFirewall(
    {
      resource_group: "control-rg",
      storage_account: "storage",
      container: "handoff",
    },
    async () => "complete",
    {
      validateException: () => [],
      publicIpv4: async () => "203.0.113.10",
      run: async (file, args) => {
        commands.push([file, ...args]);
        return args.includes("show") ? '{"publicNetworkAccess":"Disabled","securityControl":null}' : "";
      },
    },
  );
  assert.equal(result, "complete");
  const rendered = commands.map((command) => command.join(" "));
  assert.ok(rendered.some((command) => command.includes("--set tags.SecurityControl=Ignore")));
  assert.ok(rendered.some((command) => command.includes("--public-network-access Enabled")));
  assert.ok(rendered.some((command) => command.includes("network-rule add")));
  assert.ok(rendered.some((command) => command.includes("network-rule remove")));
  assert.ok(rendered.some((command) => command.includes("--public-network-access Disabled")));
  assert.ok(rendered.some((command) => command.includes("--remove tags.SecurityControl")));
  assert.ok(rendered.some((command) => command.includes("account show") && command.includes("publicNetworkAccess")));
});

test("launcher cleans up before propagating a protected operation failure", async () => {
  const commands = [];
  await assert.rejects(
    withFirewall(
      {
        resource_group: "control-rg",
        storage_account: "storage",
        container: "handoff",
      },
      async () => {
        throw new Error("protected operation failed");
      },
      {
        validateException: () => [],
        publicIpv4: async () => "203.0.113.10",
        run: async (file, args) => {
          commands.push([file, ...args]);
          return args.includes("show") ? '{"publicNetworkAccess":"Disabled","securityControl":null}' : "";
        },
      },
    ),
    /protected operation failed/,
  );
  const rendered = commands.map((command) => command.join(" "));
  assert.ok(rendered.some((command) => command.includes("network-rule remove")));
  assert.ok(rendered.some((command) => command.includes("--public-network-access Disabled")));
  assert.ok(rendered.some((command) => command.includes("--remove tags.SecurityControl")));
  assert.ok(rendered.some((command) => command.includes("account show") && command.includes("publicNetworkAccess")));
});

test("launcher validates transport keys without exposing values", () => {
  assert.equal(validateTransportKey(Buffer.alloc(32, 7).toString("base64")), true);
  assert.throws(() => validateTransportKey(Buffer.alloc(31).toString("base64")), /exactly 32 bytes/);
});

test("launcher preflights selected track and gate state before dispatch", () => {
  const status = {
    result: {
      run: {
        iacTool: "bicep",
        gates: [
          { gate: 3, state: "approved" },
          { gate: 4, state: "closed" },
        ],
      },
    },
  };
  assert.equal(validateDispatchRunState(status, "bicep"), true);
  assert.throws(() => validateDispatchRunState(status, "terraform"), /does not match/);
  assert.throws(
    () =>
      validateDispatchRunState(
        { result: { run: { ...status.result.run, gates: [{ gate: 3, state: "open" }] } } },
        "bicep",
      ),
    /Gate 3/,
  );
  assert.throws(
    () =>
      validateDispatchRunState(
        {
          result: {
            run: {
              ...status.result.run,
              gates: [
                { gate: 3, state: "approved" },
                { gate: 4, state: "inherited" },
              ],
            },
          },
        },
        "bicep",
      ),
    /unsupported Gate 4/,
  );
  assert.equal(
    validateDispatchRunState(
      {
        result: {
          run: {
            ...status.result.run,
            gates: [
              { gate: 3, state: "approved" },
              { gate: 4, state: "approved" },
            ],
          },
        },
      },
      "bicep",
    ),
    true,
  );
});

test("launcher recognizes only the exact accepted local return owner", () => {
  const ownership = {
    result: {
      ownerId: "local:123e4567-e89b-42d3-a456-426614174000",
      ownerEpoch: 3,
      claimHash: "a".repeat(64),
      commit: "b".repeat(40),
    },
  };
  assert.equal(isAcceptedLocalOwnership(ownership, "local:123e4567-e89b-42d3-a456-426614174000", "b".repeat(40)), true);
  assert.equal(isAcceptedLocalOwnership(ownership, "local:other", "b".repeat(40)), false);
  assert.equal(isAcceptedLocalOwnership(ownership, ownership.result.ownerId, "c".repeat(40)), false);
});

test("launcher requires the workflow file on the default branch before dispatch", () => {
  const repository = { nameWithOwner: "owner/repo", defaultBranchRef: { name: "main" } };
  const sha = "a".repeat(40);
  const workflow = {
    type: "file",
    path: ".github/workflows/vnext-live-qualification.yml",
    sha,
  };
  assert.deepEqual(validateWorkflowBootstrap(repository, workflow, workflow, sha), {
    repository: "owner/repo",
    defaultBranch: "main",
  });
  assert.throws(
    () => validateWorkflowBootstrap(repository, { ...workflow, path: ".github/workflows/other.yml" }, workflow, sha),
    /reviewed onto main/,
  );
  assert.throws(
    () => validateWorkflowBootstrap(repository, workflow, { ...workflow, sha: "b".repeat(40) }, sha),
    /byte-identical/,
  );
  assert.throws(() => validateWorkflowBootstrap({ nameWithOwner: "owner/repo" }, null, null, null), /metadata/);
});

test("launcher strictly parses dispatch and retrieve arguments", () => {
  const common = [
    "--yes",
    "--track",
    "bicep",
    "--operation",
    "apply",
    "--resource-group",
    "control-rg",
    "--storage-account",
    "storage",
  ];
  assert.equal(parseArgs(["dispatch", ...common, "--ref", "feat/apex-vnext-rewrite"]).container, "handoff");
  const retrieved = parseArgs([
    "retrieve",
    ...common,
    "--handoff-id",
    "123e4567-e89b-42d3-a456-426614174000",
    "--destination",
    "/tmp/candidate",
  ]);
  assert.equal(retrieved.stage, "apply");
  assert.throws(() => parseArgs(["dispatch", ...common, "--ref", "main"]), /must be feat/);
  assert.throws(() => parseArgs(["dispatch", ...common, "--ref", "feat/apex-vnext-rewrite", "--extra", "x"]));
});
