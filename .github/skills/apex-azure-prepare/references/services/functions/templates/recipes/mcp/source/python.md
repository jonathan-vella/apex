# Python MCP Tools

Use the official Azure Functions MCP extension, not an HTTP JSON-RPC handler.
See [configuration and verification](../README.md#verification-gate).
The extension owns initialization, notifications, schemas, results, errors and transport.

## Dependencies

Pin `azure-functions==1.24.0` in requirements.txt. Use Python 3.11 or later and
the shared host configuration from the recipe README.

## tools.py

```python
def require_text(value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("A non-empty string is required")
    return value


def get_weather(city: str) -> dict:
    return {"demo": True, "city": require_text(city), "temperature": 72, "conditions": "sunny"}


def search_docs(query: str) -> dict:
    return {"demo": True, "results": [f"Result for: {require_text(query)}"], "count": 1}


def run_query(sql: str) -> dict:
    return {"demo": True, "sql": require_text(sql), "rows": [], "message": "Demo only; no database query executed"}
```

## function_app.py

```python
import json

import azure.functions as func

import tools

app = func.FunctionApp()


def properties(name: str) -> str:
    return json.dumps([{
        "propertyName": name,
        "propertyType": "string",
        "description": f"Non-empty {name}",
        "isRequired": True,
        "isArray": False,
    }])


@app.mcp_tool_trigger(arg_name="context", tool_name="get_weather",
                      description="Demo weather; no live weather service", tool_properties=properties("city"))
def get_weather(context: str) -> str:
    return json.dumps(tools.get_weather(json.loads(context)["arguments"]["city"]))


@app.mcp_tool_trigger(arg_name="context", tool_name="search_docs",
                      description="Demo documentation search", tool_properties=properties("query"))
def search_docs(context: str) -> str:
    return json.dumps(tools.search_docs(json.loads(context)["arguments"]["query"]))


@app.mcp_tool_trigger(arg_name="context", tool_name="run_query",
                      description="Demo only; never executes SQL", tool_properties=properties("sql"))
def run_query(context: str) -> str:
    return json.dumps(tools.run_query(json.loads(context)["arguments"]["sql"]))


@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse('{"status":"healthy","type":"mcp"}', mimetype="application/json")
```

The tool functions return application strings; the extension wraps them in MCP
`content` blocks. Exceptions become tool errors, not successful diagnostic strings.
The anonymous health route exposes no arguments, secrets or tool execution.
Native Functions transport verification requires Core Tools and host storage;
Python unit execution alone does not prove the extension's wire behavior.

## Local SDK Host: sdk_server.py

This alternative uses `mcp==1.26.0` (the official MCP Python SDK, not the
separate fastmcp package). Put sdk_server.py alongside tools.py in a separate
local project. It uses the same tool functions without Functions or Azure storage.
The SDK owns schemas, content, exceptions, protocol negotiation and authentication.

```python
import hmac
import os
import time

from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from pydantic import AnyHttpUrl
from starlette.responses import JSONResponse

import tools


def create_server(token: str, port: int = 3001, expires_at: int | None = None,
                  scopes: list[str] | None = None) -> FastMCP:
    if not isinstance(token, str) or len(token.strip()) < 32:
        raise ValueError("MCP_DEMO_TOKEN must contain at least 32 characters")
    expected = token.encode("utf-8")
    expiry = int(time.time()) + 3600 if expires_at is None else expires_at
    granted_scopes = ["tools:invoke"] if scopes is None else scopes

    class LocalTokenVerifier(TokenVerifier):
        async def verify_token(self, candidate: str) -> AccessToken | None:
            if not hmac.compare_digest(candidate.encode("utf-8"), expected):
                return None
            return AccessToken(token=candidate, client_id="local-demo",
                               scopes=granted_scopes, expires_at=expiry)

    server = FastMCP(
        "recipe-demo", host="127.0.0.1", port=port,
        stateless_http=True, json_response=True,
        token_verifier=LocalTokenVerifier(),
        auth=AuthSettings(
            issuer_url=AnyHttpUrl(f"http://127.0.0.1:{port}"),
            resource_server_url=AnyHttpUrl(f"http://127.0.0.1:{port}/mcp"),
            required_scopes=["tools:invoke"],
        ),
    )
    server.tool(name="get_weather", description="Demo weather; no live weather service",
                structured_output=False)(tools.get_weather)
    server.tool(name="search_docs", description="Demo documentation search",
                structured_output=False)(tools.search_docs)
    server.tool(name="run_query", description="Demo only; never executes SQL",
                structured_output=False)(tools.run_query)

    @server.custom_route("/health", methods=["GET"])
    async def health(request):
        return JSONResponse({"status": "healthy", "type": "mcp"})

    return server


if __name__ == "__main__":
    create_server(os.environ.get("MCP_DEMO_TOKEN"), int(os.environ.get("PORT", "3001"))).run(
        transport="streamable-http")
```

Run `python sdk_server.py` with a process-local `MCP_DEMO_TOKEN` configured
outside chat and source control. This loopback-only pre-shared-token verifier is
for offline tests, not Entra JWT validation. The local issuer URL reserves metadata
for the SDK; no authorization/token issuance endpoint is implemented. Clients must
supply the token directly, not attempt OAuth discovery. Do not publish this verifier.
Azure uses the native extension's system key or built-in identity authentication.
