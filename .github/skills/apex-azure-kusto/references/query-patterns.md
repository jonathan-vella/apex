<!-- ref:query-patterns-v1 -->

# Kusto Query Patterns

Detailed KQL query patterns with examples for common data analysis scenarios.

## Pattern 1: Basic Data Retrieval

Fetch recent records from a table with simple filtering.

**Example KQL**:

```kql
Events
| where Timestamp > ago(1h)
| take 100
```

**Use for**: Quick data inspection, recent event retrieval

## Pattern 2: Aggregation Analysis

Summarize data by dimensions for insights and reporting.

**Example KQL**:

```kql
Events
| summarize count() by EventType, bin(Timestamp, 1h)
| order by count_ desc
```

**Use for**: Event counting, distribution analysis, top-N queries

## Pattern 3: Time Series Analytics

Analyze data over time windows for trends and patterns.

**Example KQL**:

```kql
Telemetry
| where Timestamp > ago(24h)
| summarize avg(ResponseTime), percentiles(ResponseTime, 50, 95, 99) by bin(Timestamp, 5m)
| render timechart
```

**Use for**: Performance monitoring, trend analysis, anomaly detection

## Pattern 4: Join and Correlation

Combine multiple tables for cross-dataset analysis.

**Example KQL**:

```kql
Events
| where EventType == "Error"
| join kind=inner (
    Logs
    | where Severity == "Critical"
) on CorrelationId
| project Timestamp, EventType, LogMessage, Severity
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
