# MCP (Model Context Protocol) Recipe

Exposes demonstration tools through the official Azure Functions MCP extension.
The former HTTP JSON-RPC dispatchers have been replaced, not retained behind a guard.
Tools implement application logic only; the extension or official SDK owns the protocol.

## Integration Paths

| Language | Native Functions implementation | Local alternative without Core Tools |
| --- | --- | --- |
| [Python](source/python.md) | `azure-functions==1.24.0`, `mcp_tool_trigger` | Official `mcp==1.26.0` FastMCP host |
| [JavaScript](source/javascript.md) | `@azure/functions@4.9.0`, `app.mcpTool` | Official `@modelcontextprotocol/sdk@1.26.0` HTTP host |
| [TypeScript](source/typescript.md) | `@azure/functions@4.9.0`, TypeScript `5.9.3`, `app.mcpTool` | JavaScript SDK pattern; native TS build still required |
| [.NET](source/dotnet.md) | Isolated Worker `2.1.0`, Worker.Extensions.Mcp `1.0.0` | Native build/manual host check |
| [Java](source/java.md) | Functions library `3.2.2`, Maven plugin `1.40.0`, MCP annotations | Native build/manual host check |
| [PowerShell](source/powershell.md) | **Unsupported by the MCP extension** | PowerShell 7 tool logic behind the Node SDK host |

Every language retains `get_weather` and `search_docs`. Python and TypeScript also
retain `run_query`, explicitly returning "no database query executed". Weather and
search are deterministic demonstrations, not live integrations. Real data access
or a different remote hosting design requires separate authorization.

## Composition

1. Select the matching official Functions template from the [catalog](../../mcp.md).
   Keep its discovery entry point, dependency/build configuration and deployment layout.
2. Merge the language's pinned dependencies and replace only its old MCP dispatcher
   with the native tool registrations. Do not register an HTTP route named `mcp`.
3. Merge the host settings below. Do not remove unrelated extensions or functions.
4. Build/package the selected runtime and inspect emitted trigger metadata before
   its native client test. Missing .NET/Java tools are manual checks, not source blockers.
5. Keep Bicep or Terraform resources in the selected base's layout. These examples
   supply application bindings, not a verified IaC adaptation or deployment authorization.

### host.json

For Python, JavaScript, TypeScript and Java, use this exact bundle interval for
reproducible recipe evaluation. Bundle `4.30.0` contains the MCP extension. .NET
uses its compiled package reference instead; omit extensionBundle for that model.
Review newer releases and rerun verification before updating these evidence pins.

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.30.0, 4.30.1)"
  },
  "extensions": {
    "mcp": {
      "serverName": "recipe-demo",
      "serverVersion": "1.0.0",
      "instructions": "Deterministic demo tools; no live data access or SQL execution",
      "system": {
        "webhookAuthorizationLevel": "System"
      }
    }
  }
}
```

### Transport And Storage

Use Streamable HTTP at `/runtime/webhooks/mcp`, not `/api/mcp`. The legacy SSE
endpoint is `/runtime/webhooks/mcp/sse`. SSE specifically needs Queue storage and
the corresponding identity roles; retain `enableQueue: true` when SSE is required.
Do not assume that flag exists in Terraform or that it establishes MCP support.
Streamable HTTP does not require the SSE queue backplane. Normal Functions host
storage requirements still apply. Local Core Tools must be **4.0.7030 or later**;
use an already-approved local emulator/configuration, not a live storage account
for offline testing. HTTP/2 settings alone do not implement MCP streaming.

### Authentication

Native Azure endpoints require the **system key named `mcp_extension`**, not an
ordinary function key. Send it in `x-functions-key`, not a logged URL query string.
Do not set webhookAuthorizationLevel to Anonymous. An anonymous `/api/health`
returns only status/type and cannot execute a tool. Local Core Tools normally
relaxes key enforcement; a successful local call is not proof of Azure auth.
Built-in MCP identity authentication is an alternative that requires separately
validated Entra/Easy Auth configuration; this recipe does not create it.

Example VS Code MCP configuration with protected input rather than a stored key:

```json
{
  "inputs": [
    { "type": "promptString", "id": "function-host", "description": "Function app hostname" },
    { "type": "promptString", "id": "mcp-system-key", "description": "mcp_extension system key", "password": true }
  ],
  "servers": {
    "functions-demo": {
      "type": "http",
      "url": "https://${input:function-host}/runtime/webhooks/mcp",
      "headers": { "x-functions-key": "${input:mcp-system-key}" }
    }
  }
}
```

Local SDK hosts instead expose loopback `/mcp` with SDK bearer authentication.
Their pre-shared test-token verifier is not OAuth issuance or Entra JWT validation.
Do not publish those local verifiers or treat them as Functions adapters.

## Verification Gate

Source remediation is implemented. Deployment readiness remains **unverified**
until the selected host/runtime and IaC package pass their own acceptance checks.
Missing dependencies do not justify restoring a dispatcher, retiring tools or
claiming another language's tests establish native support.

The focused tests extract source examples and include actual SDK client suites for:

- `initialize`, server information/capabilities and supported version negotiation.
- `notifications/initialized` with HTTP 202 and no response body before tool discovery.
- `tools/list` with required, typed JSON Schema `inputSchema` properties.
- `tools/call` content, preserved demo results, invalid arguments and `isError` failures.
- Unknown tools/methods, numeric/string IDs, malformed requests and invalid version headers.
- Separate health and denied missing/invalid/expired tokens or insufficient scopes.
- Lifecycle cleanup and PowerShell-backed tool execution without shell interpolation.

An unknown initialization version is a negotiation offer: the server responds with
a supported version, and the client must disconnect if it cannot use that version.
It is not necessarily a protocol error. Unsupported subsequent HTTP version headers
are rejected. No hand-written version negotiation belongs in the demo handlers.

Run only the MCP slice from the repository root:

```bash
node --test --test-name-pattern='SK-14' tools/tests/scripts/test_recipe_remediation.mjs
```

Tests never download dependencies. When provisioned with separate approval, set
`MCP_NODE_DIR` to a directory whose node_modules contains SDK `1.26.0`, zod
`3.25.76` and express `5.1.0`; set `MCP_PYTHON` to a Python executable with
`mcp==1.26.0`. Explicit but invalid paths fail rather than silently skip. The Node
suite uses an ephemeral loopback port. Python uses the real SDK HTTP client through
in-process ASGI transport, with no external network. Neither suite calls a model.

In the remediation session, package installations were denied and no SDK was
available. Those suites therefore **skip**, not pass. Native host, Azure auth and
Bicep/Terraform packaging checks remain pending. Public source reading was allowed;
no install-denial bypass, privileged install, Azure write or paid model call occurred.
See [current results](eval/summary.md) and [historical Python results](eval/python.md).

## Source Evidence

Read on 2026-09-14; these are upstream APIs/patterns, not evidence of local deployment:

- [Microsoft Learn: MCP bindings, authentication, transports and runtime support](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-mcp)
  (published revision `5122a365a28eadb69aaa1cef6c686afda52e41ee`).
- [Microsoft Learn: tool triggers and required properties](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-mcp-tool-trigger)
  (published revision `afc5a7b5c197b8ea2449d469ca8c6213123792ef`).
- [Node Functions 4.9.0 MCP types](https://github.com/Azure/azure-functions-nodejs-library/blob/v4.9.0/types/mcpTool.d.ts).
- [Extension bundle 4.30.0 manifest](https://github.com/Azure/azure-functions-extension-bundles/blob/4.30.0/src/Microsoft.Azure.Functions.ExtensionBundle/extensions.json).
- [.NET extension 1.0.0 property attribute](https://github.com/Azure/azure-functions-mcp-extension/blob/1.0.0/src/Microsoft.Azure.Functions.Worker.Extensions.Mcp/McpToolPropertyAttribute.cs).
- [Node MCP SDK 1.26.0 stateless HTTP example](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.26.0/src/examples/server/simpleStatelessStreamableHttp.ts)
  and [SDK bearer middleware](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.26.0/src/server/auth/middleware/bearerAuth.ts).
- [Python MCP SDK 1.26.0: FastMCP, HTTP clients and token verification](https://github.com/modelcontextprotocol/python-sdk/tree/v1.26.0).
