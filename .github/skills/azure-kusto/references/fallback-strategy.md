<!-- ref:fallback-strategy-v1 -->

# Fallback Strategy: Azure CLI Commands

If Azure MCP Kusto tools fail, timeout, or are unavailable, use Azure CLI commands as fallback.

## CLI Command Reference

| Operation      | Azure CLI Command                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------- |
| List clusters  | `az kusto cluster list --resource-group <rg-name>`                                                |
| List databases | `az kusto database list --cluster-name <cluster> --resource-group <rg-name>`                      |
| Show cluster   | `az kusto cluster show --name <cluster> --resource-group <rg-name>`                               |
| Show database  | `az kusto database show --cluster-name <cluster> --database-name <db> --resource-group <rg-name>` |

## KQL Query via Azure CLI

For queries, use the Kusto REST API or direct cluster URL:

```bash
az rest --method post \
  --url "https://<cluster>.<region>.kusto.windows.net/v1/rest/query" \
  --body "{ \"db\": \"<database>\", \"csl\": \"<kql-query>\" }"
```

## When to Fallback

Switch to Azure CLI when:

- MCP tool returns timeout error (queries > 60 seconds)
- MCP tool returns "service unavailable" or connection errors
- Authentication failures with MCP tools
- Empty response when database is known to have data
