# JavaScript MCP Tools

Native Azure Functions uses `@azure/functions` **4.9.0** and the MCP extension.
Keep the base entry point and load the new .mjs registration file through its
existing discovery pattern; do not delete unrelated HTTP functions.
See [host configuration and evidence](../README.md#verification-gate).

## tools.mjs

```javascript
export function requireText(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("A non-empty string is required");
  return value;
}

export const tools = {
  get_weather: {
    parameter: "city",
    description: "Demo weather; no live weather service",
    handler: ({ city }) => ({ demo: true, city: requireText(city), temperature: 72, conditions: "sunny" }),
  },
  search_docs: {
    parameter: "query",
    description: "Demo documentation search",
    handler: ({ query }) => ({ demo: true, results: [`Result for: ${requireText(query)}`], count: 1 }),
  },
};
```

## functions.mjs

Place alongside tools.mjs under the existing function discovery path.

```javascript
import { app } from "@azure/functions";
import { tools } from "./tools.mjs";

for (const [name, tool] of Object.entries(tools)) {
  app.mcpTool(name, {
    toolName: name,
    description: tool.description,
    toolProperties: [{
      propertyName: tool.parameter,
      propertyType: "string",
      description: `Non-empty ${tool.parameter}`,
      isRequired: true,
      isArray: false,
    }],
    handler: async (_invocation, context) => JSON.stringify(await tool.handler(context.triggerMetadata.mcptoolargs)),
  });
}

app.http("health", {
  route: "health",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ jsonBody: { status: "healthy", type: "mcp" } }),
});
```

The extension creates JSON Schema `inputSchema`, MCP `content` and error results.
Only tool arguments enter these handlers; they never process protocol envelopes.

## Local SDK Host: sdk-server.mjs

This alternative runs the same tools without Core Tools or Azure storage. It is
not a Functions HTTP adapter and does not prove Functions host compatibility.
Place it alongside tools.mjs in a separate local project, not in Functions discovery.
Pin `@modelcontextprotocol/sdk` **1.26.0**, `zod` **3.25.76** and `express` **5.1.0**.
The SDK's stateless Streamable HTTP transport owns the wire protocol. Its bearer
middleware owns missing, invalid, expired and insufficient-scope rejection.

```javascript
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { z } from "zod";
import { tools } from "./tools.mjs";

export function createServer(definitions = tools) {
  const server = new McpServer({ name: "recipe-demo", version: "1.0.0" });
  for (const [name, tool] of Object.entries(definitions)) {
    server.registerTool(name, {
      description: tool.description,
      inputSchema: { [tool.parameter]: z.string().min(1).describe(`Non-empty ${tool.parameter}`) },
    }, async (arguments_) => ({
      content: [{ type: "text", text: JSON.stringify(await tool.handler(arguments_)) }],
    }));
  }
  return server;
}

export function createHttpApp({ token, expiresAt = Math.floor(Date.now() / 1000) + 3600, scopes = ["tools:invoke"], definitions = tools }) {
  if (typeof token !== "string" || token.trim().length < 32) throw new Error("MCP_DEMO_TOKEN must contain at least 32 characters");
  const expected = Buffer.from(token);
  const verifier = {
    async verifyAccessToken(candidate) {
      const supplied = Buffer.from(candidate);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        throw new InvalidTokenError("Invalid token");
      }
      return { token: candidate, clientId: "local-demo", scopes, expiresAt };
    },
  };
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  app.get("/health", (_request, response) => response.json({ status: "healthy", type: "mcp" }));
  app.use("/mcp", requireBearerAuth({ verifier, requiredScopes: ["tools:invoke"] }));
  app.post("/mcp", async (request, response) => {
    const server = createServer(definitions);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    response.on("close", () => { void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch {
      if (!response.headersSent) response.sendStatus(500);
    }
  });
  app.all("/mcp", (_request, response) => response.set("Allow", "POST").sendStatus(405));
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createHttpApp({ token: process.env.MCP_DEMO_TOKEN });
  const listener = app.listen(Number(process.env.PORT ?? 3000), "127.0.0.1");
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => listener.close());
}
```

Run `node sdk-server.mjs` after setting a process-local `MCP_DEMO_TOKEN` outside
chat and source control. This is loopback-only pre-shared-token testing, not an
OAuth authorization server or Entra token validator. Do not publish this verifier.
For Azure use the native extension's system-key or built-in identity authentication.
