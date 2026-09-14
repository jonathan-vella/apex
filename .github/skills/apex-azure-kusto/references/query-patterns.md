<!-- ref:query-patterns-v1 -->

# Kusto Query Patterns

Detailed KQL query patterns with examples for common data analysis scenarios.

## Pattern 1: Basic Data Retrieval

Fetch recent records from a table with simple filtering.

**Example KQL**:

```kql
Events
| where Timestamp between (ago(1h) .. now())
| order by Timestamp desc
| take 100
```

**Use for**: Quick data inspection, recent event retrieval

## Pattern 2: Aggregation Analysis

Summarize data by dimensions for insights and reporting.

**Example KQL**:

```kql
Events
| where Timestamp between (ago(24h) .. now())
| summarize count() by EventType, bin(Timestamp, 1h)
| order by count_ desc
| take 100
```

**Use for**: Event counting, distribution analysis, top-N queries

## Pattern 3: Time Series Analytics

Analyze data over time windows for trends and patterns.

**Example KQL**:

```kql
Telemetry
| where Timestamp between (ago(24h) .. now())
| summarize avg(ResponseTime), percentiles(ResponseTime, 50, 95, 99) by bin(Timestamp, 5m)
| order by Timestamp asc
| take 1000
| render timechart
```

**Use for**: Performance monitoring, trend analysis, anomaly detection

## Pattern 4: Join and Correlation

Combine multiple tables for cross-dataset analysis.

**Example KQL**:

```kql
let windowEnd = now();
let windowStart = windowEnd - 1h;
Events
| where Timestamp between (windowStart .. windowEnd)
| where EventType == "Error"
| join kind=inner (
    Logs
    | where Timestamp between (windowStart .. windowEnd)
    | where Severity == "Critical"
    | project CorrelationId, LogTimestamp=Timestamp, LogMessage, Severity
) on CorrelationId
| project Timestamp, LogTimestamp, CorrelationId, EventType, LogMessage, Severity
| order by Timestamp desc
| take 100
```

**Use for**: Root cause analysis, correlated event tracking

## Pattern 5: Schema Discovery

Explore table structure before querying.

**Tools**: `kusto_table_schema_get`

**Use for**: Understanding data model, query planning

## KQL Best Practices

**🟢 Performance Optimized:**

- Filter early: Use `where` before joins and aggregations
- Limit result size: Use `take` or `limit` to reduce data transfer
- Time filters: Always filter by time range for time series data
- Bound both join inputs before joining, then cap output; correlation IDs may repeat
- Output limits bound transfer, not scan cost or join cardinality; narrow the time
    window and keys before running high-cardinality joins. Report truncation and use
    explicit time-window paging when complete results are needed
- Indexed columns: Filter on indexed columns first

**🔵 Query Patterns:**

- Use `summarize` for aggregations instead of `count()` alone
- Use `bin()` for time bucketing in time series
- Use `project` to select only needed columns
- Use `extend` to add calculated fields

**🟡 Common Functions:**

- `ago(timespan)`: Relative time (ago(1h), ago(7d))
- `between(start .. end)`: Range filtering
- `startswith()`, `contains()`, `matches regex`: String filtering
- `parse`, `extract`: Extract values from strings
- `percentiles()`, `avg()`, `sum()`, `max()`, `min()`: Aggregations
