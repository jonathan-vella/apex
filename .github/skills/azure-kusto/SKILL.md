---
name: azure-kusto
description: "Query and analyze data in Azure Data Explorer (Kusto/ADX) using KQL for log analytics, telemetry, and time series analysis. WHEN: KQL queries, Kusto database queries, Azure Data Explorer, ADX clusters, log analytics, time series data, IoT telemetry, anomaly detection."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# Azure Data Explorer (Kusto) Query & Analytics

Execute KQL queries and manage Azure Data Explorer resources for fast, scalable big data analytics on log, telemetry, and time series data.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**

- "Query my Kusto database for [data pattern]"
- "Show me events in the last hour from Azure Data Explorer"
- "Analyze logs in my ADX cluster"
- "Run a KQL query on [database]"
- "What tables are in my Kusto database?"
- "Show me the schema for [table]"
- "List my Azure Data Explorer clusters"
- "Aggregate telemetry data by [dimension]"
- "Create a time series chart from my logs"

**Key Indicators:**

- Mentions "Kusto", "Azure Data Explorer", "ADX", or "KQL"
- Log analytics or telemetry analysis requests
- Time series data exploration
- IoT data analysis queries
- SIEM or security analytics tasks
- Requests for data aggregation on large datasets
- Performance monitoring or APM queries

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

📋 **Reference**: Read `references/query-patterns.md` for 5 detailed KQL patterns with examples:

| Pattern               | Use For                            |
| --------------------- | ---------------------------------- |
| Basic Data Retrieval  | Quick inspection, recent events    |
| Aggregation Analysis  | Counting, distribution, top-N      |
| Time Series Analytics | Performance monitoring, trends     |
| Join and Correlation  | Root cause analysis, event tracing |
| Schema Discovery      | Data model exploration             |

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

- Filter early: `where` before joins and aggregations
- Limit results: `take` or `limit` for exploratory queries
- Always include time range filters for time series data
- Use `summarize` for aggregations, `bin()` for time bucketing
- Use `project` to select only needed columns

📋 **Reference**: Read `references/query-patterns.md` for complete function reference and performance tips.

## Best Practices

- Always include time range filters to optimize query performance
- Use `take` or `limit` for exploratory queries to avoid large result sets
- Leverage `summarize` for aggregations instead of client-side processing
- Store frequently-used queries as functions in the database
- Use materialized views for repeated aggregations
- Monitor query performance and resource consumption
- Apply data retention policies to manage storage costs
- Use streaming ingestion for real-time analytics (< 1 second latency)
- Integrate with Azure Monitor for operational insights

## MCP Tools Used

| Tool                     | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `kusto_cluster_list`     | List all Azure Data Explorer clusters in a subscription |
| `kusto_database_list`    | List all databases in a specific Kusto cluster          |
| `kusto_query`            | Execute KQL queries against a Kusto database            |
| `kusto_table_schema_get` | Retrieve schema information for a specific table        |

**Required Parameters**:

- `subscription`: Azure subscription ID or display name
- `cluster`: Kusto cluster name (e.g., "mycluster")
- `database`: Database name
- `query`: KQL query string (for query operations)
- `table`: Table name (for schema operations)

**Optional Parameters**:

- `resource-group`: Resource group name (for listing operations)
- `tenant`: Azure AD tenant ID

## Fallback Strategy: Azure CLI

📋 **Reference**: Read `references/fallback-strategy.md` for CLI command reference and KQL query via REST API.

Switch to CLI when MCP tools return timeout, service unavailable, auth failures, or empty responses.

## Common Issues

- **Access Denied**: Verify database permissions (Viewer role minimum for queries)
- **Query Timeout**: Optimize query with time filters, reduce result set, or increase timeout
- **Syntax Error**: Validate KQL syntax - common issues: missing pipes, incorrect operators
- **Empty Results**: Check time range filters (may be too restrictive), verify table name
- **Cluster Not Found**: Check cluster name format (exclude ".kusto.windows.net" suffix)
- **High CPU Usage**: Query too broad - add filters, reduce time range, limit aggregations
- **Ingestion Lag**: Streaming data may have 1-30 second delay depending on ingestion method

## Use Cases

- **Log Analytics**: Application logs, system logs, audit logs
- **IoT Analytics**: Sensor data, device telemetry, real-time monitoring
- **Security Analytics**: SIEM data, threat detection, security event correlation
- **APM**: Application performance metrics, user behavior, error tracking

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                         | When to Load                                             |
| --------------------------------- | -------------------------------------------------------- |
| `references/query-patterns.md`    | KQL patterns, examples, best practices, common functions |
| `references/fallback-strategy.md` | CLI commands and REST API fallback when MCP tools fail   |

- **Business Intelligence**: Clickstream analysis, user analytics, operational KPIs
