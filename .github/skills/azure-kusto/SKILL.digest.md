<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Data Explorer (Kusto) Query & Analytics (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**

- "Query my Kusto database for [data pattern]"
- "Show me events in the last hour from Azure Data Explorer"
- "Analyze logs in my ADX cluster"
- "Run a KQL query on [database]"

> _See SKILL.md for full content._

## Overview

This skill enables querying and managing Azure Data Explorer (Kusto), a fast and highly scalable data exploration service optimized for log and telemetry data. Azure Data Explorer provides sub-second query performance on billions of records using the Kusto Query Language (KQL).

Key capabilities:

- **Query Execution**: Run KQL queries against massive datasets
- **Schema Exploration**: Discover tables, columns, and data types

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## Key Data Fields

When executing queries, common field patterns:

- **Timestamp**: Time of event (datetime) - use `ago()`, `between()`, `bin()` for time filtering
- **EventType/Category**: Classification field for grouping
- **CorrelationId/SessionId**: For tracing related events
- **Severity/Level**: For filtering by importance

> _See SKILL.md for full content._

## Result Format

Query results include:

- **Columns**: Field names and data types
- **Rows**: Data records matching query
- **Statistics**: Row count, execution time, resource utilization
- **Visualization**: Chart rendering hints (timechart, barchart, etc.)

> _See SKILL.md for full content._

## KQL Best Practices

- Filter early: `where` before joins and aggregations
- Limit results: `take` or `limit` for exploratory queries
- Always include time range filters for time series data
- Use `summarize` for aggregations, `bin()` for time bucketing
- Use `project` to select only needed columns

> _See SKILL.md for full content._

## Best Practices

- Always include time range filters to optimize query performance
- Use `take` or `limit` for exploratory queries to avoid large result sets
- Leverage `summarize` for aggregations instead of client-side processing
- Store frequently-used queries as functions in the database
- Use materialized views for repeated aggregations
- Monitor query performance and resource consumption

> _See SKILL.md for full content._
