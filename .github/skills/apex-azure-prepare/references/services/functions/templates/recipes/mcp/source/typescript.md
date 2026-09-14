# TypeScript MCP Tools

Use `@azure/functions` **4.9.0** and TypeScript **5.9.3**. Keep the base
src/index.ts discovery entry point; run the base project's build to emit dist/.
Use the [shared host configuration](../README.md#verification-gate).

## src/functions/mcp.ts

```typescript
import { app, InvocationContext } from "@azure/functions";

function argument(context: InvocationContext, name: string): string {
  const arguments_ = context.triggerMetadata.mcptoolargs as Record<string, unknown> | undefined;
  const value = arguments_?.[name];
  if (typeof value !== "string" || !value.trim()) throw new Error("A non-empty string is required");
  return value;
}

const tools: Record<string, { parameter: string; description: string; invoke: (value: string) => object }> = {
  get_weather: {
    parameter: "city",
    description: "Demo weather; no live weather service",
    invoke: (city) => ({ demo: true, city, temperature: 72, conditions: "sunny" }),
  },
  search_docs: {
    parameter: "query",
    description: "Demo documentation search",
    invoke: (query) => ({ demo: true, results: [`Result for: ${query}`], count: 1 }),
  },
  run_query: {
    parameter: "sql",
    description: "Demo only; never executes SQL",
    invoke: (sql) => ({ demo: true, sql, rows: [], message: "Demo only; no database query executed" }),
  },
};

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
    handler: async (_invocation: unknown, context: InvocationContext): Promise<string> =>
      JSON.stringify(tool.invoke(argument(context, tool.parameter))),
  });
}

app.http("health", {
  route: "health",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ jsonBody: { status: "healthy", type: "mcp" } }),
});
```

The official extension owns initialization, notifications, JSON Schema
`inputSchema`, `content` results, error conversion and Streamable HTTP.
These callbacks receive tool arguments, never JSON-RPC requests.
The SQL example only returns a demonstration result; it never opens a database.
Transpilation and stubbed registration are not a native SDK typecheck or Functions
host handshake. Both Bicep and Terraform packaging need those separate checks.
