---
name: azure-kusto
description: '**ANALYSIS SKILL** — Query and analyze data in Azure Data Explorer (Kusto/ADX) using KQL. WHEN: "KQL queries", "Kusto database queries", "Azure Data Explorer", "ADX clusters", "time series data", "IoT telemetry", "anomaly detection". DO NOT USE FOR: App Insights / Log Analytics troubleshooting (azure-diagnostics), cost analysis (azure-cost-optimization).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# Azure Data Explorer (Kusto) Query & Analytics

Execute KQL queries against Azure Data Explorer for fast, scalable big-data
analytics on log, telemetry, and time-series data.

## Prerequisites

- **Azure CLI** authenticated (`az login`) with a subscription containing Kusto resources
- **RBAC**: `AllDatabasesViewer` on the cluster, or `Database Viewer` per database
- **Azure MCP server** configured in `.vscode/mcp.json` for the `mcp_azure-mcp_kusto`
  namespace; CLI fallback in
  [`references/fallback-strategy.md`](references/fallback-strategy.md)

## Steps

1. **Discover resources** — list clusters and databases in the subscription
2. **Explore schema** — `kusto_table_schema_get` for table structure
3. **Query data** — `kusto_query` with a KQL expression
4. **Analyse results** — aggregate, visualise, export

## Query Patterns Quick Reference

| Pattern               | Use For                            |
| --------------------- | ---------------------------------- |
| Basic Data Retrieval  | Quick inspection, recent events    |
| Aggregation Analysis  | Counting, distribution, top-N      |
| Time Series Analytics | Performance monitoring, trends     |
| Join and Correlation  | Root-cause analysis, event tracing |
| Schema Discovery      | Data model exploration             |

For full KQL syntax, examples, best practices, and performance tips, read
[`references/query-patterns.md`](references/query-patterns.md).

## Rules

- Always include a time-range filter (`where Timestamp > ago(...)`) on time-series tables
- Use `take`/`limit` for exploratory queries
- Filter early (`where` before `join` / `summarize`)
- Use `summarize` for aggregations; `bin()` for time bucketing
- Use `project` to select only needed columns

## MCP Tools

| Tool                     | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `kusto_cluster_list`     | List Kusto clusters in a subscription                   |
| `kusto_database_list`    | List databases in a cluster                             |
| `kusto_query`            | Execute KQL against a database                          |
| `kusto_table_schema_get` | Retrieve table schema                                   |

Required parameters: `subscription`, `cluster`, `database`, `query` (or `table`).
Optional: `resource-group`, `tenant`.

For CLI fallback (timeouts, auth failures), read
[`references/fallback-strategy.md`](references/fallback-strategy.md).

## Reference Index

| Reference                         | When to Load                                             |
| --------------------------------- | -------------------------------------------------------- |
| `references/query-patterns.md`    | KQL patterns, examples, best practices, common functions |
| `references/fallback-strategy.md` | CLI commands and REST API fallback when MCP tools fail   |
