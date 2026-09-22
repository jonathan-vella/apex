# PowerShell MCP Tools

**Native Functions PowerShell MCP trigger: unsupported.** Microsoft explicitly
excludes PowerShell apps from the
[MCP extension](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-mcp).
This applies to both Bicep and Terraform; changing IaC cannot add a runtime binding.

The demo capabilities remain available through the official Node MCP SDK host
from [javascript.md](javascript.md#local-sdk-host-sdk-servermjs), invoking a fixed
PowerShell 7 script. This is a local Node-hosted MCP server with PowerShell tool
logic, not a supported native PowerShell Functions deployment. A remote host
containing both runtimes would need a separately approved hosting design.

## demo-tools.ps1

```powershell
param([Parameter(Mandatory)][ValidateSet('get_weather', 'search_docs')][string]$ToolName)

$ErrorActionPreference = 'Stop'
$arguments = [Console]::In.ReadToEnd() | ConvertFrom-Json -AsHashtable
$propertyName = if ($ToolName -eq 'get_weather') { 'city' } else { 'query' }
$value = $arguments[$propertyName]
if ($value -isnot [string] -or [string]::IsNullOrWhiteSpace($value)) {
        throw 'A non-empty string is required'
}
$result = if ($ToolName -eq 'get_weather') {
        @{ demo = $true; city = $value; temperature = 72; conditions = 'sunny' }
} else {
        @{ demo = $true; results = @("Result for: $value"); count = 1 }
}
$result | ConvertTo-Json -Depth 5 -Compress
```

## powershell-server.mjs

Place alongside demo-tools.ps1, tools.mjs and sdk-server.mjs from the JavaScript
example. Use its exact dependency pins and local token prerequisites.

```javascript
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tools, requireText } from "./tools.mjs";
import { createHttpApp } from "./sdk-server.mjs";

const script = fileURLToPath(new URL("./demo-tools.ps1", import.meta.url));
export const definitions = Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, {
    ...tool,
    handler: (arguments_) => {
        requireText(arguments_[tool.parameter]);
        const result = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", script, "-ToolName", name], {
            input: JSON.stringify(arguments_),
            encoding: "utf8",
            shell: false,
            timeout: 5000,
            maxBuffer: 16384,
        });
        if (result.error || result.status !== 0) throw new Error("PowerShell demo failed");
        return JSON.parse(result.stdout);
    },
}]));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const app = createHttpApp({ token: process.env.MCP_DEMO_TOKEN, definitions });
    const listener = app.listen(Number(process.env.PORT ?? 3000), "127.0.0.1");
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => listener.close());
}
```

Run `node powershell-server.mjs`. The SDK handles initialization, notifications,
inputSchema validation, content, errors and authentication, with a separate
anonymous `/health`. Tool failure, timeout and non-JSON output become SDK tool
errors. User values travel only as JSON on stdin, never as executable PowerShell.
The short synchronous demo is bounded; production concurrency needs an approved
async worker design. No model, weather, search or Azure API is called.
