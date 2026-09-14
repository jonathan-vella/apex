# Java MCP Tools

Use Java 17 and the official Functions MCP annotations. Merge these pinned
dependencies into pom.xml and set the existing `azure-functions-maven-plugin`
version to **1.40.0**. Keep its packaging configuration and other functions.

```xml
<dependencies>
  <dependency>
    <groupId>com.microsoft.azure.functions</groupId>
    <artifactId>azure-functions-java-library</artifactId>
    <version>3.2.2</version>
  </dependency>
  <dependency>
    <groupId>com.google.code.gson</groupId>
    <artifactId>gson</artifactId>
    <version>2.10.1</version>
  </dependency>
</dependencies>
```

## src/main/java/com/function/McpTools.java

```java
package com.function;

import com.microsoft.azure.functions.*;
import com.microsoft.azure.functions.annotation.*;
import com.google.gson.Gson;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class McpTools {
    private static final Gson GSON = new Gson();

    private static String requireText(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("A non-empty string is required");
        return value;
    }

    @FunctionName("GetWeather")
    public String getWeather(
            @McpToolTrigger(name = "get_weather", description = "Demo weather; no live weather service") String context,
            @McpToolProperty(name = "city", propertyType = "string", description = "Non-empty city", isRequired = true) String city) {
        return GSON.toJson(Map.of("demo", true, "city", requireText(city), "temperature", 72, "conditions", "sunny"));
    }

    @FunctionName("SearchDocs")
    public String searchDocs(
            @McpToolTrigger(name = "search_docs", description = "Demo documentation search") String context,
            @McpToolProperty(name = "query", propertyType = "string", description = "Non-empty query", isRequired = true) String query) {
        return GSON.toJson(Map.of("demo", true, "results", List.of("Result for: " + requireText(query)), "count", 1));
    }

    @FunctionName("health")
    public HttpResponseMessage health(
            @HttpTrigger(name = "request", route = "health", methods = {HttpMethod.GET}, authLevel = AuthorizationLevel.ANONYMOUS)
            HttpRequestMessage<Optional<String>> request) {
        return request.createResponseBuilder(HttpStatus.OK)
                .header("Content-Type", "application/json")
                .body("{\"status\":\"healthy\",\"type\":\"mcp\"}")
                .build();
    }
}
```

Use the [shared host settings](../README.md#verification-gate). MCP initialization,
notifications, inputSchema, content and protocol/tool errors belong to the extension,
not the Java handlers. Maven package generation must discover `mcpToolTrigger` and
required `mcpToolProperty` bindings. Java compilation and native Core Tools testing
remain manual when those tools are unavailable, for both Bicep and Terraform.
