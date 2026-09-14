import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const skills = new URL("../../../.github/skills/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, skills), "utf8");
const recipes = "apex-azure-prepare/references/services/functions/templates/recipes/";
const languages = ["dotnet", "javascript", "typescript", "python", "java", "powershell"];
const blocks = (text, language) =>
  [...text.matchAll(new RegExp(String.raw`\x60{3}${language}\n([\s\S]*?)\x60{3}`, "g"))].map((match) => match[1]);

function nodeRegistrations(recipe) {
  const registrations = new Map();
  const bindings = [];
  const api = {
    app: Object.fromEntries(
      ["http", "sql", "storageBlob"].map((kind) => [
        kind,
        (name, options) => registrations.set(name, { kind, ...options }),
      ]),
    ),
    input: {
      storageBlob: (options) => {
        bindings.push(options);
        return options;
      },
    },
    output: {
      sql: (options) => {
        bindings.push(options);
        return options;
      },
    },
  };
  for (const source of blocks(read(`${recipes}${recipe}/source/javascript.md`), "javascript")) {
    runInNewContext(source, {
      require: (name) => {
        assert.ok(["@azure/functions", "@azure/functions-extensions-blob"].includes(name));
        return api;
      },
    });
  }
  return { registrations, bindings };
}

test("SK-13 JavaScript SQL executes registered output with valid, missing and malformed input", async () => {
  const { registrations, bindings } = nodeRegistrations("sql");
  assert.equal(registrations.get("sqlTriggerToDo").connectionStringSetting, "AZURE_SQL_CONNECTION_STRING_KEY");
  assert.equal(bindings[0].connectionStringSetting, "AZURE_SQL_CONNECTION_STRING_KEY");
  assert.equal(bindings[0].commandText, "dbo.ToDo");
  const output = registrations.get("httpTriggerSqlOutput");
  assert.equal(output.authLevel, "function");
  const writes = [];
  const context = { log() {}, extraOutputs: { set: (...args) => writes.push(args) } };
  const item = { id: "fixture", title: "Title", url: "https://example.invalid" };
  assert.equal((await output.handler({ json: async () => item }, context)).status, 201);
  assert.equal(writes[0][0], bindings[0]);
  assert.equal(writes[0][1], item);
  for (const body of [null, {}, { title: "missing URL" }]) {
    assert.equal((await output.handler({ json: async () => body }, context)).status, 400);
  }
  assert.equal(
    (
      await output.handler(
        {
          json: async () => {
            throw new Error("malformed");
          },
        },
        context,
      )
    ).status,
    400,
  );
  assert.equal(writes.length, 1);
});

test("SK-13 JavaScript Blob registers dynamic containers and propagates copy failures", async () => {
  const { registrations, bindings } = nodeRegistrations("blob-eventgrid");
  const trigger = registrations.get("ProcessBlobUpload");
  assert.equal(trigger.path, "%BLOB_CONTAINER_NAME%/{name}");
  assert.equal(trigger.source, "EventGrid");
  assert.equal(bindings[0].path, "%BLOB_PROCESSED_CONTAINER_NAME%");
  assert.equal(trigger.connection, bindings[0].connection);
  const bytes = Buffer.from("fixture PDF");
  const uploads = [];
  let exists = false;
  let failure = false;
  const source = {
    blobClient: { getProperties: async () => ({ contentLength: bytes.length }), downloadToBuffer: async () => bytes },
  };
  const destination = {
    containerClient: {
      getBlobClient: (name) => {
        assert.equal(name, "processed-fixture.pdf");
        return { exists: async () => exists };
      },
      uploadBlockBlob: async (...args) => {
        if (failure) throw new Error("copy failed");
        uploads.push(args);
      },
    },
  };
  const context = {
    triggerMetadata: { name: "fixture.pdf" },
    log() {},
    error() {},
    extraInputs: {
      get: (binding) => {
        assert.equal(binding, bindings[0]);
        return destination;
      },
    },
  };
  await trigger.handler(source, context);
  assert.deepEqual(uploads, [["processed-fixture.pdf", bytes, bytes.length]]);
  exists = true;
  await trigger.handler(source, context);
  assert.equal(uploads.length, 1);
  exists = false;
  failure = true;
  await assert.rejects(trigger.handler(source, context), /copy failed/);
});

test("SK-13 PowerShell Blob uses parsed binary output binding and emits original bytes", () => {
  const document = read(`${recipes}blob-eventgrid/source/powershell.md`);
  const { bindings } = blocks(document, "json")
    .map(JSON.parse)
    .find((value) => value.bindings?.some((binding) => binding.type === "blobTrigger"));
  const input = bindings.find((binding) => binding.type === "blobTrigger");
  const output = bindings.find((binding) => binding.direction === "out");
  assert.equal(input.path, "%BLOB_CONTAINER_NAME%/{name}");
  assert.equal(output.path, "%BLOB_PROCESSED_CONTAINER_NAME%/processed-{name}");
  assert.equal(output.dataType, "binary");
  assert.equal(input.connection, output.connection);
  const source = blocks(document, "powershell")[0];
  assert.doesNotMatch(source, /AzStorageBlob|ProcessedContainer|-Stream/);
  const fixture = `$ErrorActionPreference = 'Stop'
function Push-OutputBinding { param($Name, $Value, $ErrorAction)
  if ($Name -ne 'ProcessedBlob' -or [Convert]::ToBase64String($Value) -ne 'AAEC/w==') { throw 'Incorrect output' }
  $script:called = $true
}
& ([scriptblock]::Create($env:RECIPE_SOURCE)) -InputBlob ([byte[]](0,1,2,255)) -TriggerMetadata @{Name='fixture.pdf'}
if (-not $script:called) { throw 'No output' }
`;
  const result = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", fixture], {
    env: { ...process.env, RECIPE_SOURCE: source },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

for (const recipe of ["sql", "blob-eventgrid"]) {
  test(`SK-13 Python ${recipe} executes source and captures binding registration with runtime stubs`, () => {
    const source = blocks(read(`${recipes}${recipe}/source/python.md`), "python");
    const fixture = String.raw`
import sys, types, json
payload = json.load(sys.stdin)
registrations = []
module = types.ModuleType("azure.functions")
class App:
    def __getattr__(self, kind):
        def decorate(*args, **kwargs):
            def capture(handler):
                registrations.append((kind, args, kwargs, handler))
                return handler
            return capture
        return decorate
class Out:
    def __class_getitem__(cls, item): return cls
    def set(self, value): self.value = value
class Row:
    @classmethod
    def from_dict(cls, value): return value
class Response:
    def __init__(self, body, status_code=200, **kwargs): self.body, self.status_code = body, status_code
module.FunctionApp = App
module.Out = Out
module.SqlRow = Row
module.HttpRequest = object
module.HttpResponse = Response
module.BlobSource = types.SimpleNamespace(EVENT_GRID="EventGrid")
sys.modules["azure"] = types.ModuleType("azure")
sys.modules["azure.functions"] = module
for name in ["azurefunctions", "azurefunctions.extensions", "azurefunctions.extensions.bindings"]:
    sys.modules[name] = types.ModuleType(name)
blob = types.ModuleType("azurefunctions.extensions.bindings.blob")
blob.BlobClient = blob.ContainerClient = object
sys.modules[blob.__name__] = blob
if payload["recipe"] == "sql":
    model = types.ModuleType("todo_item")
    sys.modules["todo_item"] = model
    exec(payload["source"][1], model.__dict__)
namespace = {}
exec(payload["source"][0], namespace)
if payload["recipe"] == "sql":
    bindings = [options for kind, args, options, handler in registrations if kind in ["sql_trigger", "sql_output"]]
    assert len(bindings) == 2
    assert all(binding["connection_string_setting"] == "AZURE_SQL_CONNECTION_STRING_KEY" for binding in bindings)
    assert bindings[0]["table_name"] == bindings[1]["command_text"] == "[dbo].[ToDo]"
    output = Out()
    item = {"id":"fixture", "title":"Title", "url":"https://example.invalid"}
    response = namespace["http_trigger_sql_output"](types.SimpleNamespace(get_json=lambda: item), output)
    assert response.status_code == 201 and output.value == item
    assert namespace["http_trigger_sql_output"](types.SimpleNamespace(get_json=lambda: {}), Out()).status_code == 400
else:
    bindings = {kind: options for kind, args, options, handler in registrations}
    assert bindings["function_name"]["name"] == "ProcessBlobUpload"
    assert bindings["blob_trigger"]["path"] == "%BLOB_CONTAINER_NAME%/{name}"
    assert bindings["blob_input"]["path"] == "%BLOB_PROCESSED_CONTAINER_NAME%"
    assert bindings["blob_trigger"]["connection"] == bindings["blob_input"]["connection"] == "PDFProcessorSTORAGE"
    copies = []
    exists = False
    data = b"fixture PDF"
    source = types.SimpleNamespace(get_blob_properties=lambda: types.SimpleNamespace(name="fixture.pdf", size=len(data)), download_blob=lambda: types.SimpleNamespace(readall=lambda: data))
    target = types.SimpleNamespace(get_blob_client=lambda name: types.SimpleNamespace(exists=lambda: exists), upload_blob=lambda *args, **kwargs: copies.append((args, kwargs)))
    namespace["process_blob_upload"](source, target)
    assert copies == [(("processed-fixture.pdf", data), {"overwrite": True})]
    exists = True
    namespace["process_blob_upload"](source, target)
    assert len(copies) == 1
    exists = False
    def fail(*args, **kwargs): raise RuntimeError("copy failed")
    target.upload_blob = fail
    try:
        namespace["process_blob_upload"](source, target)
    except RuntimeError as error:
        assert str(error) == "copy failed"
    else:
        raise AssertionError("Copy failure was swallowed")
print("binding registration and mocked data flow passed; not Functions SDK acceptance")
`;
    const result = spawnSync("python3", ["-c", fixture], {
      input: JSON.stringify({ recipe, source }),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  });
}

for (const language of ["dotnet", "java", "typescript", "powershell"]) {
  test(`SK-13 ${language} SQL checks each actual trigger/output binding, not prose`, () => {
    const fence = { dotnet: "csharp", java: "java", typescript: "typescript", powershell: "json" }[language];
    const source = blocks(read(`${recipes}sql/source/${language}.md`), fence);
    if (language === "powershell") {
      const bindings = source
        .map(JSON.parse)
        .flatMap((value) => value.bindings ?? [])
        .filter((binding) => ["sqlTrigger", "sql"].includes(binding.type));
      assert.equal(bindings.length, 2);
      for (const binding of bindings) assert.equal(binding.connectionStringSetting, "AZURE_SQL_CONNECTION_STRING_KEY");
    } else {
      const bindings = [
        ...source
          .join("\n")
          .matchAll(/(?:connectionStringSetting\s*[:=]\s*|\[SqlTrigger\("\[dbo\]\.\[ToDo\]",\s*)"([^"]+)"/g),
      ];
      assert.equal(bindings.length, 2);
      for (const binding of bindings) assert.equal(binding[1], "AZURE_SQL_CONNECTION_STRING_KEY");
    }
  });
}

for (const language of ["dotnet", "java", "typescript"]) {
  test(`SK-13 ${language} Blob source resolves default and custom container contracts on both tracks`, () => {
    const fence = { dotnet: "csharp", java: "java", typescript: "typescript" }[language];
    const source = blocks(read(`${recipes}blob-eventgrid/source/${language}.md`), fence).join("\n");
    const paths = [...source.matchAll(/(?:path\s*[:=]\s*|\[Blob(?:Trigger|Input)\()"([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(paths.length, 2);
    for (const track of ["bicep", "terraform"]) {
      for (const [input, output] of [
        ["unprocessed-pdf", "processed-pdf"],
        ["custom-input", "custom-output"],
      ]) {
        const settings = { BLOB_CONTAINER_NAME: input, BLOB_PROCESSED_CONTAINER_NAME: output };
        const resolved = paths.map((binding) =>
          binding.replace(/%([^%]+)%/g, (_, key) => {
            assert.ok(Object.hasOwn(settings, key), `${track}: missing ${key}`);
            return settings[key];
          }),
        );
        assert.deepEqual(resolved.sort(), [`${input}/{name}`, output].sort());
      }
    }
  });
}

for (const recipe of ["sql", "blob-eventgrid"]) {
  test(`SK-12/13 ${recipe} Bicep compiles locally and emits the binding contract`, () => {
    const filename = recipe === "sql" ? "sql" : "blob";
    const file = new URL(`${recipes}${recipe}/bicep/${filename}.bicep`, skills).pathname;
    const result = spawnSync("bicep", ["build", file, "--stdout", "--no-restore"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const template = JSON.parse(result.stdout);
    const settings = template.outputs.appSettings.value;
    assert.ok(template.parameters.uamiClientId);
    assert.equal(Object.hasOwn(template.parameters.uamiClientId, "defaultValue"), false);
    if (recipe === "sql") {
      assert.match(settings.AZURE_SQL_CONNECTION_STRING_KEY, /Managed Identity;User Id=/);
      assert.equal(template.parameters.isProduction.defaultValue, true);
      assert.equal(template.parameters.publicNetworkAccessApproved.defaultValue, false);
      const server = template.resources.find((resource) => resource.type === "Microsoft.Sql/servers");
      assert.equal(server.properties.administrators.azureADOnlyAuthentication, true);
      assert.equal(
        server.properties.publicNetworkAccess,
        "[if(variables('publicAccessEnabled'), 'Enabled', 'Disabled')]",
      );
    } else {
      assert.equal(settings.BLOB_CONTAINER_NAME, "[parameters('containerName')]");
      assert.equal(settings.BLOB_PROCESSED_CONTAINER_NAME, "[parameters('processedContainerName')]");
      assert.equal(settings.PDFProcessorSTORAGE__clientId, "[parameters('uamiClientId')]");
      assert.equal(settings.PDFProcessorSTORAGE__credential, "managedidentity");
      assert.equal(
        template.resources.filter(
          (resource) => resource.type === "Microsoft.Storage/storageAccounts/blobServices/containers",
        ).length,
        2,
      );
    }
  });
  test(`SK-13 ${recipe} Terraform parses locally without init or provider access`, () => {
    const filename = recipe === "sql" ? "sql" : "blob";
    const file = new URL(`${recipes}${recipe}/terraform/${filename}.tf`, skills).pathname;
    const result = spawnSync("terraform", ["fmt", "-write=false", "-no-color", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  });
}

test("SK-23 quota arithmetic uses SKU vCPUs, counts and exact scope", () => {
  const source = read("apex-azure-prepare/references/resources-limits-quotas.md");
  const calculate = runInNewContext(`${blocks(source, "javascript")[0]}\nplannedQuotaTotal`);
  const evidence = {
    scope: "/subscriptions/approved/providers/Microsoft.Compute/locations/approved",
    quotaName: "cores",
    unit: "vCPU",
    current: 12,
    limit: 40,
  };
  const additions = [
    { ...evidence, instances: 3, unitsPerInstance: 4 },
    { ...evidence, instances: 2, unitsPerInstance: 8 },
  ];
  const result = calculate(evidence, additions);
  assert.equal(result.total, 40);
  assert.equal(result.headroom, 0);
  assert.equal(result.withinQuota, true);
  assert.equal(result.capacityVerified, false);
  assert.equal(calculate({ ...evidence, limit: 39 }, additions).withinQuota, false);
  for (const override of [
    { scope: "/subscriptions/other" },
    { unit: "count" },
    { quotaName: "other-family" },
    { unitsPerInstance: undefined },
    { instances: -1 },
  ]) {
    assert.throws(() => calculate(evidence, [{ ...additions[0], ...override }]), /do not match/);
  }
  const counts = { ...evidence, quotaName: "accounts", unit: "count", current: 3 };
  assert.equal(calculate(counts, [{ ...counts, instances: 2, unitsPerInstance: 1 }]).total, 5);
  assert.throws(() => calculate({ ...evidence, current: null }, []), /Incomplete/);
  for (const line of source.split("\n").filter((line) => line.includes("az graph query"))) {
    assert.ok(line.includes("--subscriptions"), line);
  }
  assert.doesNotMatch(
    source,
    /If you get `BadRequest` error, fall back|NOT supported \(BadRequest\)|"Regional capacity"\s*\| Quota/,
  );
  assert.doesNotMatch(source, /Cosmos DB accounts: 50 per region/);
  assert.doesNotMatch(
    read("apex-azure-prepare/references/plan-template.md"),
    /NOT supported\*\* \(returns `BadRequest`\)/,
  );
});

test("SK-43 prepare and migration consume one binding contract with the SQL exception", () => {
  const contract = read(`${recipes}common/uami-bindings.md`);
  assert.match(contract, /SQL is the explicit exception/);
  assert.match(contract, /AZURE_SQL_CONNECTION_STRING_KEY/);
  assert.match(contract, /PDFProcessorSTORAGE__blobServiceUri/);
  assert.match(
    read("apex-azure-cloud-migrate/references/services/functions/code-migration.md"),
    /common\/uami-bindings.md#composition-contract/,
  );
});

test("SK-22 SQL executor binds target/file approval, exact CLI flags and failures", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "recipe-sql-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const sql = "SELECT 1;";
  const file = path.join(root, "reviewed query.sql");
  writeFileSync(file, sql);
  writeFileSync(
    path.join(root, "sqlcmd"),
    "#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2))); process.exit(Number(process.env.SQL_FAILURE || 0));\n",
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${root}:${process.env.PATH}`,
    SQL_SERVER_FQDN: "approved.database.windows.net",
    SQL_DATABASE: "approved-db",
    SQL_APPROVED_TARGET: "approved.database.windows.net/approved-db",
    SQL_APPROVED_SHA256: createHash("sha256").update(sql).digest("hex"),
  };
  const script = new URL("apex-azure-deploy/scripts/run-sql.sh", skills).pathname;
  const run = (overrides = {}) =>
    spawnSync("bash", [script, file], { env: { ...env, ...overrides }, encoding: "utf8" });
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  assert.deepEqual(JSON.parse(success.stdout), [
    "-S",
    "tcp:approved.database.windows.net,1433",
    "-d",
    "approved-db",
    "--authentication-method",
    "ActiveDirectoryDefault",
    "-b",
    "-i",
    file,
  ]);
  for (const override of [{ SQL_APPROVED_TARGET: "" }, { SQL_APPROVED_SHA256: "" }, { SQL_DATABASE: "other-db" }]) {
    const result = run(override);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
  }
  assert.equal(run({ SQL_FAILURE: "9" }).status, 9);
  writeFileSync(file, "DROP TABLE changed_after_approval;");
  assert.equal(run().status, 2);
});

test("SK-22 Terraform maps azd values without env() or backend interpolation", () => {
  const source = read("apex-azure-prepare/references/recipes/azd/terraform.md");
  const hcl = blocks(source, "hcl").join("\n");
  assert.doesNotMatch(hcl, /env\(|tfstate\$\{/);
  const script = blocks(source, "bash").find((block) => block.includes("TF_VAR_database_name"));
  const fixture =
    'azd() { case "$3" in DATABASE_NAME) printf "%s" "db with spaces";; AZURE_LOCATION) printf "%s" "approved-region";; AZURE_ENV_NAME) printf "%s" "approved-env";; *) return 8;; esac; }\n';
  const result = spawnSync(
    "bash",
    [
      "-c",
      `${
        fixture + script
      }\n[[ "$TF_VAR_database_name" == "db with spaces" && "$TF_VAR_location" == "approved-region" && "$TF_VAR_environment_name" == "approved-env" ]]`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const failure = spawnSync("bash", ["-c", `azd() { return 7; }\n${script}`], { encoding: "utf8" });
  assert.equal(failure.status, 7);
});

test("SK-22 SQL consumers share the approved executor without unsupported commands", () => {
  for (const file of ["sql-managed-identity.md", "sql-entra-auth.md", "ef-migrations.md", "verify.md"]) {
    const source = read(`apex-azure-deploy/references/recipes/azd/${file}`);
    assert.match(source, /run-sql\.sh/);
    assert.doesNotMatch(source, /az sql db query|eval \$\(azd/);
  }
});

test("SK-14 Python binding replacement preserves tools without implementing JSON-RPC", () => {
  const source = blocks(read(`${recipes}mcp/source/python.md`), "python");
  const fixture = String.raw`
import sys, types, json
payload = json.load(sys.stdin)
tools = types.ModuleType("tools")
exec(payload[0], tools.__dict__)
sys.modules["tools"] = tools
module = types.ModuleType("azure.functions")
registrations = []
class App:
  def mcp_tool_trigger(self, **kwargs):
    def register(handler):
      registrations.append((kwargs, handler))
      return handler
    return register
  def route(self, **kwargs):
    return lambda handler: handler
class Response:
    def __init__(self, body, **kwargs): self.body = json.loads(body)
module.FunctionApp = App
module.HttpRequest = object
module.HttpResponse = Response
module.AuthLevel = types.SimpleNamespace(ANONYMOUS="anonymous")
sys.modules["azure"] = types.ModuleType("azure")
sys.modules["azure.functions"] = module
namespace = {}
exec(payload[1], namespace)
assert [options["tool_name"] for options, handler in registrations] == ["get_weather", "search_docs", "run_query"]
for options, handler in registrations:
  prop, = json.loads(options["tool_properties"])
  assert prop["isRequired"] and prop["propertyType"] == "string"
  result = json.loads(handler(json.dumps({"arguments": {prop["propertyName"]: "fixture"}})))
  assert result["demo"] is True
  try:
    handler(json.dumps({"arguments": {prop["propertyName"]: " "}}))
  except ValueError:
    pass
  else:
    raise AssertionError("Empty argument accepted")
assert "no database query executed" in tools.run_query("select 1")["message"]
assert namespace["health_check"](None).body["status"] == "healthy"
`;
  assert.doesNotMatch(source.join("\n"), /jsonrpc|tools\/list|tools\/call|mcp_handler/);
  const result = spawnSync("python3", ["-c", fixture], { input: JSON.stringify(source), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

for (const language of languages) {
  test(`SK-14 ${language} preserves its demo capabilities without a protocol dispatcher`, () => {
    const source = read(`${recipes}mcp/source/${language}.md`);
    const code = blocks(
      source,
      {
        dotnet: "csharp",
        java: "java",
        python: "python",
        powershell: "powershell",
        javascript: "javascript",
        typescript: "typescript",
      }[language],
    ).join("\n");
    assert.match(code, /get_weather/);
    assert.match(code, /search_docs/);
    assert.doesNotMatch(code, /jsonrpc|tools\/list|tools\/call|GetInt32\(|getAsInt\(|mcp_handler/);
    if (["python", "typescript"].includes(language)) {
      assert.match(code, /run_query/);
      assert.match(code, /no database query executed/);
    }
    if (["javascript", "typescript"].includes(language)) {
      assert.match(code, /app\.mcpTool\(/);
      assert.match(code, /isRequired: true/);
      assert.match(source, /4\.9\.0/);
    } else if (language === "dotnet") {
      assert.equal([...code.matchAll(/\[McpToolTrigger\(/g)].length, 2);
      assert.equal([...code.matchAll(/\[McpToolProperty\([^\n]+isRequired: true/g)].length, 2);
      assert.match(source, /Extensions\.Mcp" Version="1\.0\.0"/);
    } else if (language === "java") {
      assert.equal([...code.matchAll(/@McpToolTrigger\(/g)].length, 2);
      assert.equal([...code.matchAll(/@McpToolProperty\([^\n]+isRequired = true/g)].length, 2);
      assert.match(source, /<version>3\.2\.2<\/version>/);
    } else if (language === "powershell") {
      assert.match(source, /Native Functions PowerShell MCP trigger: unsupported/);
      assert.match(source, /createHttpApp/);
      assert.match(source, /shell: false/);
      assert.match(source, /timeout: 5000/);
      assert.doesNotMatch(code, /Invoke-Expression|Push-OutputBinding/);
    }
  });
}

test("SK-14 example syntax checks do not require SDK execution", async () => {
  const typescript = await import("typescript");
  for (const language of ["javascript", "powershell"]) {
    for (const source of blocks(read(`${recipes}mcp/source/${language}.md`), "javascript")) {
      const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
        input: source,
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
    }
  }
  for (const source of blocks(read(`${recipes}mcp/source/typescript.md`), "typescript")) {
    assert.equal(
      typescript.createSourceFile("mcp.ts", source, typescript.ScriptTarget.Latest, true).parseDiagnostics.length,
      0,
    );
  }
  const python = spawnSync(
    "python3",
    ["-c", "import ast, json, sys; [ast.parse(source) for source in json.load(sys.stdin)]"],
    {
      input: JSON.stringify(blocks(read(`${recipes}mcp/source/python.md`), "python")),
      encoding: "utf8",
    },
  );
  assert.equal(python.status, 0, python.stderr);
});

test("SK-14 JavaScript native registrations preserve schemas and tool failures with stubs", async () => {
  const source = blocks(read(`${recipes}mcp/source/javascript.md`), "javascript");
  const { tools } = await import(`data:text/javascript,${encodeURIComponent(source[0])}`);
  const registrations = new Map();
  const app = {
    mcpTool: (name, options) => registrations.set(name, options),
    http: (name, options) => registrations.set(name, options),
  };
  runInNewContext(source[1].replace(/^import .*;\n/gm, ""), { app, tools });
  for (const [name, tool] of Object.entries(tools)) {
    const registered = registrations.get(name);
    const property = registered.toolProperties[0];
    assert.equal(property.propertyName, tool.parameter);
    assert.equal(property.propertyType, "string");
    assert.equal(property.isRequired, true);
    for (const value of [undefined, null, 5, "", " "]) {
      await assert.rejects(registered.handler(null, { triggerMetadata: { mcptoolargs: { [tool.parameter]: value } } }));
    }
    assert.equal(
      JSON.parse(await registered.handler(null, { triggerMetadata: { mcptoolargs: { [tool.parameter]: "fixture" } } }))
        .demo,
      true,
    );
  }
  assert.equal(registrations.get("health").authLevel, "anonymous");
  assert.equal((await registrations.get("health").handler()).jsonBody.status, "healthy");
});

test("SK-14 PowerShell tools preserve data and reject invalid arguments without evaluating input", () => {
  const source = blocks(read(`${recipes}mcp/source/powershell.md`), "powershell")[0];
  const directory = mkdtempSync(path.join(tmpdir(), "sk14-powershell-"));
  try {
    const script = path.join(directory, "demo-tools.ps1");
    writeFileSync(script, source);
    for (const [name, parameter] of [
      ["get_weather", "city"],
      ["search_docs", "query"],
    ]) {
      const invoke = (arguments_) =>
        spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", script, "-ToolName", name], {
          input: JSON.stringify(arguments_),
          encoding: "utf8",
          timeout: 10000,
        });
      const value = "fixture ' ; $(throw 'must remain data')";
      const response = invoke({ [parameter]: value });
      assert.equal(response.status, 0, response.stderr);
      const result = JSON.parse(response.stdout);
      assert.equal(result.demo, true);
      assert.equal(
        name === "get_weather" ? result.city : result.results[0],
        name === "get_weather" ? value : `Result for: ${value}`,
      );
      for (const invalid of [null, 7, " "]) assert.notEqual(invoke({ [parameter]: invalid }).status, 0);
      assert.notEqual(invoke({}).status, 0);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SK-14 host configuration protects the native endpoint and pins the extension bundle", () => {
  const document = read(`${recipes}mcp/README.md`);
  const [host, client] = blocks(document, "json").map(JSON.parse);
  assert.equal(host.extensionBundle.id, "Microsoft.Azure.Functions.ExtensionBundle");
  assert.equal(host.extensionBundle.version, "[4.30.0, 4.30.1)");
  assert.equal(host.extensions.mcp.system.webhookAuthorizationLevel, "System");
  assert.match(client.servers["functions-demo"].url, /\/runtime\/webhooks\/mcp$/);
  assert.equal(client.servers["functions-demo"].headers["x-functions-key"], "${input:mcp-system-key}");
  assert.equal(client.inputs.find((input) => input.id === "mcp-system-key").password, true);
  assert.match(document, /system key named `mcp_extension`/);
  assert.match(document, /Bicep.*Terraform/s);
  assert.match(document, /SDK.*skip/s);
});

test("SK-14 SDK client fixtures parse even when dependencies are unavailable", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  const sections = [...source.matchAll(/^test\("SK-14 real (Node|Python) SDK[^\n]*\n([\s\S]*?)(?=^test\()/gm)];
  assert.equal(sections.length, 2);
  for (const [, language, section] of sections) {
    const fixture = section.match(/const fixture = String\.raw`\n([\s\S]*?)\n`;/)?.[1];
    assert.ok(fixture, `Missing ${language} fixture`);
    const result =
      language === "Node"
        ? spawnSync(process.execPath, ["--input-type=module", "--check"], { input: fixture, encoding: "utf8" })
        : spawnSync("python3", ["-c", "import ast, sys; ast.parse(sys.stdin.read())"], {
            input: fixture,
            encoding: "utf8",
          });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("SK-14 real Node SDK HTTP lifecycle, schemas, errors and auth (optional dependencies)", (context) => {
  const dependencyRoot = path.resolve(process.env.MCP_NODE_DIR ?? process.cwd());
  const probe = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'await import("@modelcontextprotocol/sdk/server/mcp.js"); await import("zod"); await import("express");',
    ],
    { cwd: dependencyRoot, encoding: "utf8" },
  );
  if (probe.status !== 0 && !process.env.MCP_NODE_DIR)
    return context.skip(
      "MCP SDK 1.26.0, zod 3.25.76 and express 5.1.0 unavailable; download approval denied, not protocol acceptance",
    );
  assert.equal(probe.status, 0, probe.stderr || probe.error?.message);
  const directory = mkdtempSync(path.join(tmpdir(), "sk14-node-sdk-"));
  try {
    symlinkSync(path.join(dependencyRoot, "node_modules"), path.join(directory, "node_modules"), "dir");
    const source = blocks(read(`${recipes}mcp/source/javascript.md`), "javascript");
    writeFileSync(path.join(directory, "tools.mjs"), source[0]);
    writeFileSync(path.join(directory, "sdk-server.mjs"), source[2]);
    writeFileSync(
      path.join(directory, "demo-tools.ps1"),
      blocks(read(`${recipes}mcp/source/powershell.md`), "powershell")[0],
    );
    writeFileSync(
      path.join(directory, "powershell-server.mjs"),
      blocks(read(`${recipes}mcp/source/powershell.md`), "javascript")[0],
    );
    const fixture = String.raw`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { createHttpApp } from "./sdk-server.mjs";
import { tools } from "./tools.mjs";
import { definitions } from "./powershell-server.mjs";
assert.equal(JSON.parse(readFileSync(new URL("../../../package.json", import.meta.resolve("@modelcontextprotocol/sdk/server/mcp.js")))).version, "1.26.0");
assert.equal(JSON.parse(readFileSync(new URL(import.meta.resolve("zod/package.json")))).version, "3.25.76");
assert.equal(JSON.parse(readFileSync(new URL(import.meta.resolve("express/package.json")))).version, "5.1.0");
const token = "sk14-local-fixture-token-not-a-secret";
const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const start = async (options = {}) => {
  const listener = createHttpApp({ token, ...options }).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { listener.once("listening", resolve); listener.once("error", reject); });
  return { listener, url: "http://127.0.0.1:" + listener.address().port };
};
const stop = async (listener) => { listener.closeAllConnections(); await new Promise((resolve) => listener.close(resolve)); };
const post = (url, body, extra = {}) => fetch(url + "/mcp", { method: "POST", headers: { ...headers, ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });
for (const implementation of [tools, definitions]) {
  const { listener, url } = await start({ definitions: implementation });
  const client = new Client({ name: "recipe-test", version: "1.0.0" });
  const messages = [];
  try {
    assert.equal((await fetch(url + "/health")).status, 200);
    for (const authorization of [undefined, "Bearer wrong", "Basic invalid"]) {
      const response = await fetch(url + "/mcp", { method: "POST", headers: { ...headers, Authorization: authorization ?? "" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_weather", arguments: { city: "fixture" } } }) });
      assert.equal(response.status, 401);
      assert.match(response.headers.get("www-authenticate"), /Bearer/);
    }
    const transport = new StreamableHTTPClientTransport(new URL(url + "/mcp"), {
      requestInit: { headers: { Authorization: "Bearer " + token } },
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        if (typeof init?.body === "string") messages.push({ request: JSON.parse(init.body), status: response.status, body: await response.clone().text() });
        return response;
      },
    });
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, "recipe-demo");
    assert.ok(client.getServerCapabilities().tools);
    const initialization = messages.find((entry) => entry.request.method === "initialize");
    assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes(JSON.parse(initialization.body).result.protocolVersion));
    const initialized = messages.find((entry) => entry.request.method === "notifications/initialized");
    assert.equal(initialized.status, 202);
    assert.equal(initialized.body, "");
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), Object.keys(tools).sort());
    for (const tool of listed.tools) {
      const parameter = tools[tool.name].parameter;
      assert.equal(tool.inputSchema.type, "object");
      assert.equal(tool.inputSchema.properties[parameter].type, "string");
      assert.ok(tool.inputSchema.required.includes(parameter));
      const result = await client.callTool({ name: tool.name, arguments: { [parameter]: "fixture" } });
      assert.ok(!result.isError);
      assert.equal(result.content[0].type, "text");
      assert.equal(JSON.parse(result.content[0].text).demo, true);
      for (const arguments_ of [{}, { [parameter]: 42 }, { [parameter]: " " }]) {
        assert.equal((await client.callTool({ name: tool.name, arguments: arguments_ })).isError, true);
      }
    }
    assert.equal((await client.callTool({ name: "unknown_tool", arguments: {} })).isError, true);
    for (const id of [7, "string-id"]) {
      const result = await (await post(url, { jsonrpc: "2.0", id, method: "unknown_method" })).json();
      assert.equal(result.id, id);
      assert.equal(result.error.code, -32601);
    }
    assert.equal((await post(url, "{")).status, 400);
    const malformed = await post(url, { jsonrpc: "2.0", id: 9, method: 42 });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, -32600);
    assert.equal((await post(url, { jsonrpc: "2.0", id: 8, method: "tools/list" }, { "MCP-Protocol-Version": "2099-01-01" })).status, 400);
    const negotiation = await (await post(url, { jsonrpc: "2.0", id: "future", method: "initialize", params: { protocolVersion: "2099-01-01", capabilities: {}, clientInfo: { name: "fixture", version: "1" } } })).json();
    assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes(negotiation.result.protocolVersion));
    assert.notEqual(negotiation.result.protocolVersion, "2099-01-01");
  } finally { await client.close(); await stop(listener); }
}
for (const [options, expected] of [[{ expiresAt: 1 }, 401], [{ scopes: [] }, 403]]) {
  const { listener, url } = await start(options);
  try { assert.equal((await post(url, { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, expected); }
  finally { await stop(listener); }
}
assert.throws(() => createHttpApp({ token: "" }));
console.log("Node SDK and PowerShell-backed tools: full HTTP lifecycle/auth passed");
`;
    writeFileSync(path.join(directory, "client-test.mjs"), fixture);
    const result = spawnSync(process.execPath, [path.join(directory, "client-test.mjs")], {
      encoding: "utf8",
      timeout: 45000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SK-14 real Python SDK HTTP lifecycle, schemas, errors and auth (optional dependencies)", (context) => {
  const python = process.env.MCP_PYTHON ?? "python3";
  const probe = spawnSync(python, ["-c", "import mcp, httpx"], { encoding: "utf8" });
  if (probe.status !== 0 && !process.env.MCP_PYTHON)
    return context.skip("Python mcp 1.26.0 unavailable; download approval denied, not protocol acceptance");
  assert.equal(probe.status, 0, probe.stderr || probe.error?.message);
  const directory = mkdtempSync(path.join(tmpdir(), "sk14-python-sdk-"));
  try {
    const source = blocks(read(`${recipes}mcp/source/python.md`), "python");
    writeFileSync(path.join(directory, "tools.py"), source[0]);
    writeFileSync(path.join(directory, "sdk_server.py"), source[2]);
    const fixture = String.raw`
import asyncio, importlib.metadata, json
import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.version import SUPPORTED_PROTOCOL_VERSIONS
from sdk_server import create_server

assert importlib.metadata.version("mcp") == "1.26.0"
TOKEN = "sk14-local-fixture-token-not-a-secret"
URL = "http://127.0.0.1:3001"
HEADERS = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "Accept": "application/json, text/event-stream"}

async def main():
    server = create_server(TOKEN)
    app = server.streamable_http_app()
    messages = []
    async def observe(response):
        if response.request.method == "POST":
            await response.aread()
            try:
                messages.append((json.loads(response.request.content), response.status_code, response.text))
            except ValueError:
                pass
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url=URL, headers=HEADERS, event_hooks={"response": [observe]}) as http:
            assert (await http.get("/health", headers={"Authorization": ""})).status_code == 200
            for authorization in ["", "Bearer wrong", "Basic invalid"]:
                response = await http.post("/mcp", headers={"Authorization": authorization}, json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_weather", "arguments": {"city": "fixture"}}})
                assert response.status_code == 401 and "Bearer" in response.headers["www-authenticate"]
            async with streamable_http_client(URL + "/mcp", http_client=http) as (read, write, _):
                async with ClientSession(read, write) as client:
                    initialized = await client.initialize()
                    assert initialized.serverInfo.name == "recipe-demo"
                    assert initialized.serverInfo.version and initialized.capabilities.tools is not None
                    assert initialized.protocolVersion in SUPPORTED_PROTOCOL_VERSIONS
                    listed = await client.list_tools()
                    notification = next(entry for entry in messages if entry[0].get("method") == "notifications/initialized")
                    assert notification[1:] == (202, "")
                    expected = {"get_weather": "city", "search_docs": "query", "run_query": "sql"}
                    assert {tool.name for tool in listed.tools} == set(expected)
                    for tool in listed.tools:
                        parameter = expected[tool.name]
                        assert tool.inputSchema["type"] == "object"
                        assert tool.inputSchema["properties"][parameter]["type"] == "string"
                        assert parameter in tool.inputSchema["required"]
                        result = await client.call_tool(tool.name, {parameter: "fixture"})
                        assert not result.isError and result.content[0].type == "text"
                        payload = json.loads(result.content[0].text)
                        assert payload["demo"] is True
                        if tool.name == "run_query":
                            assert "no database query executed" in payload["message"]
                        for arguments in [{}, {parameter: 42}, {parameter: " "}]:
                            assert (await client.call_tool(tool.name, arguments)).isError
                    assert (await client.call_tool("unknown_tool", {})).isError
            for request_id in [7, "string-id"]:
                response = await http.post("/mcp", json={"jsonrpc": "2.0", "id": request_id, "method": "unknown_method"})
                assert response.json()["id"] == request_id and response.json()["error"]["code"] == -32601
            assert (await http.post("/mcp", content="{")).status_code == 400
            malformed = await http.post("/mcp", json={"jsonrpc": "2.0", "id": 9, "method": 42})
            assert malformed.status_code == 400 and malformed.json()["error"]["code"] == -32600
            assert (await http.post("/mcp", headers={"MCP-Protocol-Version": "2099-01-01"}, json={"jsonrpc": "2.0", "id": 8, "method": "tools/list"})).status_code == 400
            negotiation = await http.post("/mcp", json={"jsonrpc": "2.0", "id": "future", "method": "initialize", "params": {"protocolVersion": "2099-01-01", "capabilities": {}, "clientInfo": {"name": "fixture", "version": "1"}}})
            assert negotiation.json()["result"]["protocolVersion"] in SUPPORTED_PROTOCOL_VERSIONS
    for options, expected_status in [({"expires_at": 1}, 401), ({"scopes": []}, 403)]:
        app = create_server(TOKEN, **options).streamable_http_app()
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url=URL, headers=HEADERS) as http:
                response = await http.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
                assert response.status_code == expected_status
    try:
        create_server("")
    except ValueError:
        pass
    else:
        raise AssertionError("Missing token accepted")
    print("Python SDK: full ASGI Streamable HTTP lifecycle/auth passed; no network")

asyncio.run(main())
`;
    const result = spawnSync(python, ["-c", fixture], { cwd: directory, encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SK-12 session examples fail closed before configuring middleware", () => {
  const source = read("apex-azure-prepare/references/runtimes/nodejs.md");
  const guards = [...source.matchAll(/const sessionSecret =[^;]+;\nif[^\n]+/g)];
  assert.equal(guards.length, 2);
  for (const [guard] of guards) {
    for (const secret of [undefined, "", "  "]) {
      assert.throws(
        () => runInNewContext(guard, { process: { env: { SESSION_SECRET: secret } } }),
        /SESSION_SECRET is required/,
      );
    }
    assert.doesNotThrow(() => runInNewContext(guard, { process: { env: { SESSION_SECRET: "fixture-only" } } }));
  }
  assert.doesNotMatch(
    read("apex-azure-prepare/references/services/key-vault/sdk.md"),
    /(?:console\.log|print|Console\.WriteLine)\([^\n]*secret\./,
  );
});

for (const language of languages) {
  for (const track of ["bicep", "terraform"]) {
    test(`SK-13 SQL ${language}/${track} uses the emitted identity connection setting`, () => {
      const source = read(`${recipes}sql/source/${language}.md`);
      const infra = read(`${recipes}sql/${track}/sql.${track === "bicep" ? "bicep" : "tf"}`);
      assert.match(source, /AZURE_SQL_CONNECTION_STRING_KEY/);
      assert.match(infra, /AZURE_SQL_CONNECTION_STRING_KEY["']?\s*[:=]/);
      assert.match(infra, /Authentication=Active Directory Managed Identity;User Id=\$\{/);
    });
  }
}

test("SK-12 production SQL cannot enable public networking on either track", () => {
  const bicep = read(`${recipes}sql/bicep/sql.bicep`);
  const terraform = read(`${recipes}sql/terraform/sql.tf`);
  assert.match(bicep, /var publicAccessEnabled = !isProduction && publicNetworkAccessApproved/);
  assert.match(bicep, /publicNetworkAccess: publicAccessEnabled \? 'Enabled' : 'Disabled'/);
  assert.match(bicep, /privateDnsZoneGroups/);
  assert.match(
    terraform,
    /public_network_access_enabled = !var.is_production && var.sql_public_network_access_approved/,
  );
  assert.match(terraform, /precondition/);
});

for (const language of languages) {
  for (const track of ["bicep", "terraform"]) {
    test(`SK-13 Blob ${language}/${track} preserves containers, endpoint and UAMI binding`, () => {
      const source = read(`${recipes}blob-eventgrid/source/${language}.md`);
      const infra = read(`${recipes}blob-eventgrid/${track}/blob.${track === "bicep" ? "bicep" : "tf"}`);
      for (const name of ["PDFProcessorSTORAGE", "ProcessBlobUpload"]) {
        assert.ok(source.includes(name), `${language}: ${name}`);
        assert.ok(infra.includes(name), `${track}: ${name}`);
      }
      for (const setting of ["BLOB_CONTAINER_NAME", "BLOB_PROCESSED_CONTAINER_NAME"]) {
        assert.ok(source.includes(`%${setting}%`), `${language}: binding consumes ${setting}`);
        assert.ok(infra.includes(setting), `${track}: emits ${setting}`);
      }
      for (const suffix of ["blobServiceUri", "credential", "clientId"]) {
        assert.ok(infra.includes(`PDFProcessorSTORAGE__${suffix}`));
      }
      assert.match(infra, /functions\/ProcessBlobUpload/);
    });
  }
}

test("SK-11 preflight selects the recipe and checks services without applying", () => {
  const source = read("apex-azure-deploy/references/pre-deploy-checklist.md");
  assert.ok(source.indexOf("Resolve Recipe And Approval") < source.indexOf("az account show"));
  assert.match(source, /pure Terraform\/Bicep\/AZCLI callers skip/);
  assert.match(source, /explicit deployment approval/);
  assert.doesNotMatch(source, /^\s*(?:azd (?:up|provision|deploy|init)\b|terraform apply)/m);
  assert.doesNotMatch(source, /azd env get-values/);
  assert.match(source, /az group show --subscription <approved-subscription-id> --name <approved-resource-group>/);
  assert.match(source, /For Terraform, validate the approved provider\/module/);
  assert.doesNotMatch(source, /Check that `infra\/` Bicep files contain/);
});

test("SK-11 composition ends at readiness without environment overrides or apply", () => {
  for (const file of ["composition.md", "README.md"]) {
    const source = read(`${recipes}${file}`);
    assert.match(source, /Ready for Validation/);
    assert.match(source, /explicit deployment approval/);
    assert.doesNotMatch(
      source,
      /^\s*(?:azd (?:up|provision|deploy)\b|terraform apply|azd env set (?:AZURE_LOCATION|VNET_ENABLED))/m,
    );
  }
  assert.match(
    read("apex-azure-validate/references/recipes/azd/README.md"),
    /Missing SDKs, Core Tools or template evidence block/,
  );
  assert.doesNotMatch(read(`${recipes}composition.md`), /\bapp_setting\b|ALL service bindings require/);
});
