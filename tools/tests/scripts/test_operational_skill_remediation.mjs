import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const skillsRoot = new URL("../../../.github/skills/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, skillsRoot), "utf8");

test("SK-15 expiration audits use metadata without retrieving secret values", () => {
  const source = read("apex-azure-compliance/references/azure-keyvault-expiration-audit.md");
  const entry = read("apex-azure-compliance/SKILL.md");
  assert.doesNotMatch(source + entry, /keyvault_secret_get|az keyvault secret show/);
  assert.match(source, /az keyvault secret list-versions/);
  assert.match(source, /Never\s+retrieve secret values/);
  assert.match(source, /Report denied or incomplete coverage/);
});

test("SK-08 scratch ownership never authorizes generic or automatic cleanup", () => {
  const source = read("apex-azure-cost-optimization/references/detailed-workflow-steps.md");
  assert.match(source, /\[guid\]::NewGuid\(\)/);
  assert.match(source, /--body "@\$queryPath"/);
  assert.doesNotMatch(source, /Remove-Item|rm -rf|temp\/cost-query/);
  assert.match(source, /Retain scratch files on success, failure, and cancellation/);
  assert.match(source, /delete only those approved files/);
});

test("SK-17 credential creation is additive and secret handoff stays private", () => {
  const source = read("apex-entra-app-registration/references/cli-commands.md");
  const commands = source.split("\n").filter((line) => line.startsWith("az ad app credential reset"));
  assert.ok(commands.length >= 2);
  for (const command of commands) assert.match(command, /--append\b/);
  assert.match(source, /user-run private-terminal operation/);
  assert.match(source, /If no private handoff exists, stop before\s+creation/);
  assert.match(source, /separate approval to retire an exact old key ID/);
  assert.doesNotMatch(read("apex-entra-app-registration/references/troubleshooting.md"), /az ad app credential reset/);
});

test("SK-18 exclusions preserve mixed files and unrelated submodules", () => {
  const source = read("apex-github-operations/references/merge-sensei-free-pr.md");
  assert.doesNotMatch(source, /git checkout origin\/|git rm \.gitmodules|rm -rf/);
  assert.match(source, /Mixed files require hunk edits/);
  assert.match(source, /preserve other submodule sections/);
  assert.match(source, /verify every unrelated hunk and submodule survives/);
  assert.match(source, /Always require user approval before `git push` and before `gh pr create`/);
});

test("SK-19 Redis keeps mixed intent, requires evidence and reconciles estimates", () => {
  const skill = read("apex-azure-cost-optimization/SKILL.md");
  const rules = read("apex-azure-cost-optimization/references/azure-redis.md");
  const report = read("apex-azure-cost-optimization/templates/redis-detailed-cache-analysis.md");
  assert.match(skill, /Mixed-service or subscription-wide requests retain the general workflow/);
  assert.match(skill, /ambiguous Redis mention never narrows scope/);
  assert.doesNotMatch(rules + report, /Delete immediately|\$\d|az redis (?:delete|update)/i);
  assert.match(rules, /Unknown cost or utilization remains unknown, not zero/);
  assert.match(rules, /estimated saving = baseline - target/);
  assert.match(rules, /Total target = total baseline - total saving/);
  assert.match(rules, /undefined for a zero\s+baseline/);
  assert.match(rules, /retain negative savings/);
  assert.match(rules, /Sum only\s+non-overlapping recommendations/);
  assert.match(report, /Template only: placeholders are not observed/);
});

test("SK-42 cost discovery delegates canonical identity without joining names", () => {
  const source = read("apex-azure-cost-optimization/references/azure-resource-graph.md");
  assert.match(source, /apex-azure-resources\/references\/azure-resource-graph.md/);
  assert.match(source, /full `id` and `subscriptionId`/);
  assert.match(source, /never join costs by resource name/);
  assert.match(source, /omits identity, stop that correlation/);
});

test("SK-29 RBAC retains full permission blocks, data-plane grants and exclusions", () => {
  const source = read("apex-azure-rbac/SKILL.md");
  assert.match(source, /permissions:permissions,assignableScopes:assignableScopes/);
  assert.doesNotMatch(source, /permissions\[0\]|-o table|cat > custom-role/);
  for (const field of ["actions", "notActions", "dataActions", "notDataActions"]) {
    assert.ok(source.includes(`\`${field}\``), field);
  }
  assert.match(source, /exclusions subtract only from their own\s+grant, not other roles/);
  assert.match(source, /conditions, deny assignments and active PIM/);
  assert.match(source, /explicit approval for the exact principal, role and scope/);
});

test("SK-29 intended client replaces misleading CLI token tests", () => {
  const source = read("apex-entra-app-registration/references/first-app-registration.md");
  assert.doesNotMatch(source, /az login --scope|az account get-access-token|https:\/\/jwt.ms/);
  assert.match(source, /Configure MSAL with the intended client ID and tenant ID/);
  assert.match(source, /application permissions and cannot use Graph `\/me`/);
});

test("SK-29 Graph example binds client identity and separates delegated/app-only endpoints", async () => {
  const source = read("apex-entra-app-registration/references/console-app-example.md");
  const code = [...source.matchAll(/```javascript\n([\s\S]*?)```/g)][0][1].replace(/\nmain\(\);\s*$/, "");
  const calls = [];
  const configs = [];
  const output = [];
  const environment = { AZURE_CLIENT_ID: "intended-client", AZURE_TENANT_ID: "intended-tenant" };
  const context = {
    process: { env: environment },
    console: { log: (...args) => output.push(args), error: (...args) => output.push(args) },
    require: (name) => {
      if (name === "axios") return { get: async (url, options) => calls.push({ url, options }) };
      assert.equal(name, "@azure/msal-node");
      return {
        ConfidentialClientApplication: class {
          constructor(config) {
            configs.push(config);
          }
          async acquireTokenByClientCredential(request) {
            assert.deepEqual(Array.from(request.scopes), ["https://graph.microsoft.com/.default"]);
            return { accessToken: "synthetic-token" };
          }
        },
      };
    },
  };
  const api = runInNewContext(`${code}\n({ callGraphApi, acquireTokenClientCredentials });`, context);
  await api.callGraphApi("synthetic-token", "delegated");
  await assert.rejects(api.callGraphApi("synthetic-token", "app-only"), /target user ID/);
  await assert.rejects(api.callGraphApi("synthetic-token", "unknown"), /Unsupported/);
  assert.equal(calls.length, 1);
  await api.callGraphApi("synthetic-token", "app-only", "user/name");
  assert.equal(calls[0].url, "https://graph.microsoft.com/v1.0/me");
  assert.equal(calls[1].url, "https://graph.microsoft.com/v1.0/users/user%2Fname");
  await assert.rejects(api.acquireTokenClientCredentials(), /Private client credential/);
  environment.AZURE_CLIENT_SECRET = "synthetic-secret";
  await api.acquireTokenClientCredentials();
  assert.equal(configs[0].auth.clientId, "intended-client");
  assert.equal(configs[0].auth.authority, "https://login.microsoftonline.com/intended-tenant");
  assert.doesNotMatch(JSON.stringify(output), /synthetic-token|synthetic-secret/);
  delete environment.AZURE_CLIENT_ID;
  assert.throws(() => runInNewContext(code, { ...context }), /Intended client ID and tenant ID/);
});

test("SK-37 Secrets TypeScript audits metadata rather than cryptographic keys", async () => {
  const source = read("apex-azure-compliance/references/sdk/azure-keyvault-secrets-ts.md");
  assert.doesNotMatch(source, /wrap\/unwrap|encrypt, sign|Use key rotation policies/);
  assert.match(source, /@azure\/keyvault-secrets` 4.x/);
  const code = source.match(/```typescript\n([\s\S]*?)```/)[1].replace(/^import .*;\n/gm, "");
  const output = [];
  await runInNewContext(`(async () => { ${code} })()`, {
    DefaultAzureCredential: class {},
    SecretClient: class {
      async *listPropertiesOfSecrets() {
        yield { name: "example", enabled: true, expiresOn: "2030-01-01", value: "synthetic-secret" };
      }
      getSecret() {
        assert.fail("Secret values must not be requested");
      }
    },
    console: { log: (entry) => output.push(entry) },
  });
  assert.equal(output.length, 1);
  assert.deepEqual(Object.keys(output[0]), ["name", "enabled", "expiresOn"]);
  assert.doesNotMatch(JSON.stringify(output), /synthetic-secret/);
});

test("SK-42 auth callers share private identity and credential procedures", () => {
  const auth = read("apex-entra-app-registration/references/auth-best-practices.md");
  assert.match(auth, /If the required SDK\/version or flow is unavailable, report the blocker/);
  assert.match(auth, /instructions are not execution\s+approval/);
  for (const relative of [
    "apex-azure-compliance/SKILL.md",
    "apex-azure-rbac/SKILL.md",
    "apex-entra-app-registration/references/core-workflow.md",
    "apex-entra-app-registration/references/first-app-registration.md",
    "apex-entra-app-registration/references/api-permissions.md",
    "apex-entra-app-registration/references/troubleshooting.md",
  ]) {
    const source = read(relative);
    assert.match(source, /auth-best-practices.md/, relative);
    assert.doesNotMatch(source, /https:\/\/jwt.ms/, relative);
  }
});

test("SK-08 PowerShell scratch creation preserves unrelated sentinels across exit paths", (context) => {
  const available = spawnSync(
    "pwsh",
    ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    { encoding: "utf8" },
  );
  if (available.error?.code === "ENOENT") return context.skip("PowerShell is not installed");
  assert.equal(available.status, 0, available.stderr);
  const root = mkdtempSync(path.join(tmpdir(), "apex-operational-scratch-test-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "temp"));
  writeFileSync(path.join(root, "temp", "sentinel.txt"), "unrelated-user-file");
  const source = read("apex-azure-cost-optimization/references/detailed-workflow-steps.md");
  const code = source.match(/```powershell\n([\s\S]*?)```/)[1];
  const cases = [
    ["success", "exit 0", 0],
    ["failure", "throw 'synthetic failure'", 1],
    ["cancellation", "exit 130", 130],
  ];
  const runPaths = [];
  for (const [label, ending, status] of cases) {
    const result = spawnSync(
      "pwsh",
      ["-NoProfile", "-NonInteractive", "-Command", `${code}\nWrite-Output $runTemp\n${ending}`],
      {
        cwd: root,
        env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, status, `${label}: ${result.stderr}`);
    const runPath = result.stdout.trim();
    assert.ok(runPath.startsWith(root + path.sep), runPath);
    assert.ok(existsSync(runPath), label);
    assert.equal(readFileSync(path.join(root, "temp", "sentinel.txt"), "utf8"), "unrelated-user-file");
    runPaths.push(runPath);
  }
  assert.equal(new Set(runPaths).size, cases.length);
  assert.equal(readdirSync(root).length, cases.length + 1);
});

test("SK-29 CLI projection preserves every management/data/exclusion block", (context) => {
  const interpreter = "/opt/az/bin/python3";
  if (!existsSync(interpreter)) return context.skip("Installed Azure CLI Python is unavailable");
  const source = read("apex-azure-rbac/SKILL.md");
  const query = source.match(/az role definition list[^\n]+--query "([^"]+)"/)[1];
  const permissions = [
    {
      actions: ["*/read"],
      notActions: ["Microsoft.Storage/storageAccounts/read"],
      dataActions: [],
      notDataActions: [],
    },
    {
      actions: [],
      notActions: [],
      dataActions: ["Microsoft.Storage/storageAccounts/blobServices/containers/blobs/*"],
      notDataActions: ["Microsoft.Storage/storageAccounts/blobServices/containers/blobs/delete"],
    },
    { actions: ["Microsoft.Storage/storageAccounts/read"], notActions: [], dataActions: [], notDataActions: [] },
  ];
  const fixture = [
    { roleName: "Synthetic Role", name: "role-id", permissions, assignableScopes: ["/subscriptions/test"] },
  ];
  const result = spawnSync(
    interpreter,
    ["-c", "import json,sys,jmespath; print(json.dumps(jmespath.search(sys.argv[1], json.load(sys.stdin))))", query],
    {
      input: JSON.stringify(fixture),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    { name: "Synthetic Role", id: "role-id", permissions, assignableScopes: ["/subscriptions/test"] },
  ]);
});

test("SK-15 CLI audit projections exclude synthetic secret values", (context) => {
  const interpreter = "/opt/az/bin/python3";
  if (!existsSync(interpreter)) return context.skip("Installed Azure CLI Python is unavailable");
  const source = read("apex-azure-compliance/references/azure-keyvault-expiration-audit.md");
  const commands = source.split("\n").filter((line) => /az keyvault secret list/.test(line));
  assert.equal(commands.length, 2);
  for (const command of commands) {
    const query = command.match(/--query "([^"]+)"/)[1];
    const fixture = [
      { id: "synthetic-id", attributes: { enabled: true, expires: 1893456000 }, value: "synthetic-secret" },
    ];
    const result = spawnSync(
      interpreter,
      ["-c", "import json,sys,jmespath; print(json.dumps(jmespath.search(sys.argv[1], json.load(sys.stdin))))", query],
      {
        input: JSON.stringify(fixture),
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [{ id: "synthetic-id", attributes: fixture[0].attributes }]);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-secret/);
  }
});

test("SK-17 installed CLI helper preserves old secrets/certificates with documented append", (context) => {
  const interpreter = "/opt/az/bin/python3";
  if (!existsSync(interpreter)) return context.skip("Installed Azure CLI Python is unavailable");
  const source = read("apex-entra-app-registration/references/cli-commands.md");
  const commands = source.split("\n").filter((line) => line.startsWith("az ad app credential reset"));
  const fixture = String.raw`
import ast, copy, datetime, importlib.util, json, sys
from types import SimpleNamespace
from dateutil.relativedelta import relativedelta

spec = importlib.util.find_spec("azure.cli.command_modules.role.custom")
with open(spec.origin, encoding="utf-8") as source_file:
    module = ast.parse(source_file.read())
helper = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == "_reset_credential")
namespace = {
    "datetime": datetime, "relativedelta": relativedelta, "ID": "id", "CLIError": RuntimeError,
    "_build_add_password_credential_body": lambda *args: {},
    "_process_certificate": lambda *args: ("synthetic-public-cert", None, None, None),
    "_validate_app_dates": lambda *args: args,
    "_build_key_credentials": lambda **kwargs: [{"keyId": "new-cert"}],
    "logger": SimpleNamespace(warning=lambda *args: None), "CREDENTIAL_WARNING": "private output",
}
exec(compile(ast.Module(body=[helper], type_ignores=[]), spec.origin, "exec"), namespace)
original = {"id": "object-id", "appId": "intended-client", "passwordCredentials": [{"keyId": "old-secret"}], "keyCredentials": [{"keyId": "old-cert"}]}
commands = json.load(sys.stdin)
for command in commands:
    current = copy.deepcopy(original)
    removed = []
    def add_password(*args):
        current["passwordCredentials"].append({"keyId": "new-secret"})
        return {"secretText": "synthetic-secret"}
    def remove_password(identifier, body):
        removed.append(body["keyId"])
    def patch(identifier, body):
        current.update(body)
    result = namespace["_reset_credential"](SimpleNamespace(cli_ctx=None), current, add_password, remove_password, patch,
        append="--append" in command.split(), cert="synthetic-public-cert" if "--cert" in command.split() else None)
    assert not removed
    assert {"keyId": "old-secret"} in current["passwordCredentials"]
    assert {"keyId": "old-cert"} in current["keyCredentials"]
    assert result["appId"] == "intended-client"
print("additive credential fixtures passed")
`;
  const result = spawnSync(interpreter, ["-c", fixture], { input: JSON.stringify(commands), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /additive credential fixtures passed/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-secret/);
});
