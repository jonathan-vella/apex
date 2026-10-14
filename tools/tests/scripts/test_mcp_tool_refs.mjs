import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pinProblems, scanText } from "../../scripts/validate-mcp-tool-refs.mjs";
import { buildSnapshot, parseLearnReply, parametersOf, sortKeys } from "../../scripts/refresh-azure-mcp-snapshot.mjs";

const snapshot = {
  schemaVersion: 1,
  serverVersion: "3.0.0",
  tools: {
    monitor: {
      commands: {
        monitor_workspace_log_query: { parameters: { query: true, subscription: false, table: true, workspace: true } },
      },
    },
    resourcehealth: {
      commands: { "resourcehealth_availability-status_get": { parameters: { resourceId: false, subscription: true } } },
    },
    extension_cli_generate: { parameters: { "cli-type": true, intent: true } },
    group_list: { parameters: { subscription: true } },
  },
};

const problems = (text) => scanText(text, snapshot).map((problem) => problem.message);

test("accepts valid tool, command and parameter references", () => {
  assert.deepEqual(
    problems(
      'Use `mcp_azure-mcp_monitor` with `command: "monitor_workspace_log_query"`, `parameters: { workspace: "w", query: "q" }`',
    ),
    [],
  );
  assert.deepEqual(problems("| `mcp_azure-mcp_group_list` | List resource groups |"), []);
  assert.deepEqual(problems('mcp_azure-mcp_extension_cli_generate\n  intent: "x"\n  cli-type: "az"'), []);
});

test("accepts the shortened client prefix and still validates against it", () => {
  assert.deepEqual(
    problems(
      'Use `mcp_azure_mcp_ser_monitor` with `command: "monitor_workspace_log_query"`, `parameters: { workspace: "w" }`',
    ),
    [],
  );
  assert.deepEqual(problems("written `mcp_azure-mcp_<tool>` or `mcp_azure_mcp_ser_<tool>`"), []);
  assert.deepEqual(problems("`mcp_azure_mcp_ser_nope`"), ["unknown tool mcp_azure-mcp_nope"]);
  assert.deepEqual(problems('`mcp_azure_mcp_ser_monitor` command: "monitor_nope"'), [
    'mcp_azure-mcp_monitor has no command "monitor_nope"',
  ]);
});

test("flags unknown tools, commands and parameters", () => {
  assert.deepEqual(problems("`mcp_azure-mcp_nope`"), ["unknown tool mcp_azure-mcp_nope"]);
  assert.deepEqual(problems('`mcp_azure-mcp_monitor` command: "monitor_nope"'), [
    'mcp_azure-mcp_monitor has no command "monitor_nope"',
  ]);
  assert.deepEqual(
    problems('`mcp_azure-mcp_monitor` command: "monitor_workspace_log_query", parameters: { "resource-group": "rg" }'),
    ['mcp_azure-mcp_monitor has no parameter "resource-group"'],
  );
});

test("parameter names are case sensitive", () => {
  assert.deepEqual(
    problems(
      'mcp_azure-mcp_resourcehealth\n  command: "resourcehealth_availability-status_get"\n  parameters:\n    resourceid: "x"',
    ),
    ['mcp_azure-mcp_resourcehealth has no parameter "resourceid"'],
  );
});

test("flags direct-tool parameters that do not exist", () => {
  assert.deepEqual(problems("mcp_azure-mcp_group_list({ subscription: 's', location: 'l' })"), [
    'mcp_azure-mcp_group_list has no parameter "location"',
  ]);
});

test("the ignore marker skips a reference on the same or previous line", () => {
  assert.deepEqual(problems("`mcp_azure-mcp_nope` <!-- mcp-ref:ignore -->"), []);
  assert.deepEqual(problems("<!-- mcp-ref:ignore -->\n`mcp_azure-mcp_nope`"), []);
});

test("snapshot builder is deterministic and keeps wrapped and direct tools apart", () => {
  const listed = [
    { name: "wrapped", inputSchema: { properties: { command: {}, intent: {} } } },
    { name: "direct", inputSchema: { properties: { b: {}, a: {} }, required: ["a"] } },
  ];
  const learned = { wrapped: [{ command: "w_get", inputSchema: { properties: { z: {} }, required: ["z"] } }] };
  const first = JSON.stringify(buildSnapshot("9.9.9", listed, learned));
  assert.equal(first, JSON.stringify(buildSnapshot("9.9.9", [...listed].reverse(), learned)));
  assert.deepEqual(JSON.parse(first).tools, {
    direct: { parameters: { a: true, b: false } },
    wrapped: { commands: { w_get: { parameters: { z: true } } } },
  });
  assert.deepEqual(parametersOf(undefined), {});
  assert.deepEqual(Object.keys(sortKeys({ b: 1, a: { d: 1, c: 2 } })), ["a", "b"]);
});

test("learn replies are parsed from prose plus JSON and fail loudly otherwise", () => {
  assert.deepEqual(parseLearnReply('Here are the commands: [{"command":"x"}]'), [{ command: "x" }]);
  assert.throws(() => parseLearnReply("no commands here"));
});

test("pin check compares both configuration files with the snapshot version", (context) => {
  const root = mkdtempSync(join(tmpdir(), "mcp-pin-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".vscode"));
  mkdirSync(join(root, ".devcontainer"));
  const write = (workspace, defaults) => {
    writeFileSync(
      join(root, ".vscode/mcp.json"),
      JSON.stringify({ servers: { "azure-mcp": { args: ["-y", `@azure/mcp@${workspace}`] } } }),
    );
    writeFileSync(join(root, ".devcontainer/configure-mcp.mjs"), `args: ["-y", "@azure/mcp@${defaults}"]`);
  };
  write("3.0.0", "3.0.0");
  assert.deepEqual(pinProblems(root, snapshot), []);
  write("3.0.1", "3.0.0");
  assert.equal(pinProblems(root, snapshot).length, 1);
  write("3.0.1", "2.0.5");
  assert.equal(pinProblems(root, snapshot).length, 2);
});
