<!-- ref:common-issues-v1 -->

# Kusto Common Issues

Adapted from the upstream `azure-kusto` skill. Keep every retry bounded, as in
[query patterns](query-patterns.md).

| Symptom           | Likely cause                                             | Next step                                                                                                |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Access denied     | The identity lacks a database role                       | Confirm the database Viewer role (minimum for queries); request access rather than switching identities |
| Query timeout     | Scan too broad                                           | Add a `Timestamp between (...)` filter and `take`, narrow columns, then retry once                       |
| Syntax error      | Missing pipe, wrong operator or misspelled column        | Check the table schema before rewriting the query                                                        |
| Empty results     | Time range too narrow or wrong table                     | Widen the window deliberately and confirm the table name; empty is not proof of absence                  |
| Cluster not found | Cluster name includes the `.kusto.windows.net` suffix    | Pass the short cluster name, or the full URI where the tool expects one                                   |
| High CPU usage    | Broad aggregations over long windows                     | Filter before `summarize`, shorten the window and limit aggregations                                     |
| Ingestion lag     | Streaming or queued ingestion has not landed yet         | Allow for delays of seconds to minutes depending on the ingestion method before concluding data is missing |
