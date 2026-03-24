<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Messaging SDK Troubleshooting (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Quick Reference

| Property      | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| **Services**  | Azure Event Hubs, Azure Service Bus                            |
| **MCP Tools** | `mcp_azure_mcp_eventhubs`, `mcp_azure_mcp_servicebus`          |
| **Best For**  | Diagnosing SDK connection, auth, and message processing issues |

## When to Use This Skill

SDK connection failures, auth errors, AMQP link errors, message lock/session issues,
send/receive timeouts, event processor stops, SDK configuration questions.

## MCP Tools

| Tool                           | Command           | Use                                            |
| ------------------------------ | ----------------- | ---------------------------------------------- |
| `mcp_azure_mcp_eventhubs`      | Namespace/hub ops | List namespaces, hubs, consumer groups         |
| `mcp_azure_mcp_servicebus`     | Queue/topic ops   | List namespaces, queues, topics, subscriptions |
| `mcp_azure_mcp_monitor`        | `logs_query`      | Query diagnostic logs with KQL                 |
| `mcp_azure_mcp_resourcehealth` | `get`             | Check service health status                    |

> _See SKILL.md for full content._

## Diagnosis Workflow

1. **Identify the SDK and version**
2. **Check resource health** — Use `mcp_azure_mcp_resourcehealth`
3. **Review the error message** — Match against language-specific troubleshooting guide
4. **Look up documentation** — Use `mcp_azure_mcp_documentation`
5. **Check configuration** — Verify connection string, entity name, consumer group
6. **Recommend fix** — Apply remediation, citing documentation found
