<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Data Explorer (Kusto) Query & Analytics (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Query my Kusto database for [data pattern]"
- "Show me events in the last hour from Azure Data Explorer"
- "Analyze logs in my ADX cluster"
- "Run a KQL query on [database]"
- "What tables are in my Kusto database?"
- "Show me the schema for [table]"
- "List my Azure Data Explorer clusters"

> _See SKILL.md for full content._

## Overview

This skill enables querying and managing Azure Data Explorer (Kusto), a fast and highly scalable data exploration service optimized for log and telemetry data. Azure Data Explorer provides sub-second query performance on billions of records using the Kusto Query Language (KQL).

Key capabilities:
- **Query Execution**: Run KQL queries against massive datasets
- **Schema Exploration**: Discover tables, columns, and data types
- **Resource Management**: List clusters and databases
- **Analytics**: Aggregations, time series, anomaly detection, machine learning


## Core Workflow

1. **Discover Resources**: List available clusters and databases in subscription
2. **Explore Schema**: Retrieve table structures to understand data model
3. **Query Data**: Execute KQL queries for analysis, filtering, aggregation
4. **Analyze Results**: Process query output for insights and reporting


## Query Patterns

### Pattern 1: Basic Data Retrieval
Fetch recent records from a table with simple filtering.

**Example KQL**:
```kql
Events
| where Timestamp > ago(1h)
| take 100

> _See SKILL.md for full content._

## Key Data Fields

When executing queries, common field patterns:
- **Timestamp**: Time of event (datetime) - use `ago()`, `between()`, `bin()` for time filtering
- **EventType/Category**: Classification field for grouping
- **CorrelationId/SessionId**: For tracing related events
- **Severity/Level**: For filtering by importance
- **Dimensions**: Custom properties for grouping and filtering


## Result Format

Query results include:
- **Columns**: Field names and data types
- **Rows**: Data records matching query
- **Statistics**: Row count, execution time, resource utilization
- **Visualization**: Chart rendering hints (timechart, barchart, etc.)


## KQL Best Practices

**🟢 Performance Optimized:**
- Filter early: Use `where` before joins and aggregations
- Limit result size: Use `take` or `limit` to reduce data transfer
- Time filters: Always filter by time range for time series data
- Indexed columns: Filter on indexed columns first

**🔵 Query Patterns:**
- Use `summarize` for aggregations instead of `count()` alone

> _See SKILL.md for full content._

## Best Practices

- Always include time range filters to optimize query performance
- Use `take` or `limit` for exploratory queries to avoid large result sets
- Leverage `summarize` for aggregations instead of client-side processing
- Store frequently-used queries as functions in the database
- Use materialized views for repeated aggregations
- Monitor query performance and resource consumption
- Apply data retention policies to manage storage costs
- Use streaming ingestion for real-time analytics (< 1 second latency)

> _See SKILL.md for full content._

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `kusto_cluster_list` | List all Azure Data Explorer clusters in a subscription |
| `kusto_database_list` | List all databases in a specific Kusto cluster |
| `kusto_query` | Execute KQL queries against a Kusto database |
| `kusto_table_schema_get` | Retrieve schema information for a specific table |

**Required Parameters**:

> _See SKILL.md for full content._

## Fallback Strategy: Azure CLI Commands

If Azure MCP Kusto tools fail, timeout, or are unavailable, use Azure CLI commands as fallback.

### CLI Command Reference

| Operation | Azure CLI Command |
|-----------|-------------------|
| List clusters | `az kusto cluster list --resource-group <rg-name>` |
| List databases | `az kusto database list --cluster-name <cluster> --resource-group <rg-name>` |

> _See SKILL.md for full content._

## Common Issues

- **Access Denied**: Verify database permissions (Viewer role minimum for queries)
- **Query Timeout**: Optimize query with time filters, reduce result set, or increase timeout
- **Syntax Error**: Validate KQL syntax - common issues: missing pipes, incorrect operators
- **Empty Results**: Check time range filters (may be too restrictive), verify table name
- **Cluster Not Found**: Check cluster name format (exclude ".kusto.windows.net" suffix)
- **High CPU Usage**: Query too broad - add filters, reduce time range, limit aggregations
- **Ingestion Lag**: Streaming data may have 1-30 second delay depending on ingestion method

