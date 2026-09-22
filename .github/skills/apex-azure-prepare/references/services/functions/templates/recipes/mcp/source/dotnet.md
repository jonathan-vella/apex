# C# (.NET) MCP Tools

Use .NET 8 isolated worker, not the in-process model. Keep the base project's
Worker SDK build configuration and discovery entry point. Merge these pinned
references into its ItemGroup; System.Text.Json is provided by .NET 8.

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="2.1.0" />
  <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Http" Version="3.3.0" />
  <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Mcp" Version="1.0.0" />
</ItemGroup>
```

## Program.cs

For a base using the standard isolated HTTP model (HttpRequestData), its entry
point must configure the worker. Retain any existing service registrations.

```csharp
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .Build();
host.Run();
```

## McpTools.cs

```csharp
using System;
using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Extensions.Mcp;
using Microsoft.Azure.Functions.Worker.Http;

namespace McpFunctions;

public class McpTools
{
    private static string RequireText(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("A non-empty string is required");
        return value;
    }

    [Function("GetWeather")]
    public string GetWeather(
        [McpToolTrigger("get_weather", "Demo weather; no live weather service")] ToolInvocationContext context,
        [McpToolProperty("city", "Non-empty city", isRequired: true)] string city)
    {
        return JsonSerializer.Serialize(new { demo = true, city = RequireText(city), temperature = 72, conditions = "sunny" });
    }

    [Function("SearchDocs")]
    public string SearchDocs(
        [McpToolTrigger("search_docs", "Demo documentation search")] ToolInvocationContext context,
        [McpToolProperty("query", "Non-empty query", isRequired: true)] string query)
    {
        return JsonSerializer.Serialize(new { demo = true, results = new[] { $"Result for: {RequireText(query)}" }, count = 1 });
    }

    [Function("health")]
    public HttpResponseData Health(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData request)
    {
        var response = request.CreateResponse(HttpStatusCode.OK);
        response.Headers.Add("Content-Type", "application/json");
        response.WriteString("{\"status\":\"healthy\",\"type\":\"mcp\"}");
        return response;
    }
}
```

Use the [shared MCP host settings](../README.md#verification-gate), omitting
extensionBundle for this compiled project. The extension owns initialization,
notifications, inputSchema generation, content results, tool errors and transport.
Build and Core Tools handshake remain manual checks where .NET is unavailable;
that is a verification gap, not a reason to retain a broken protocol dispatcher.
