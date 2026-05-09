<!-- ref:pricing-guidance-v1 -->

# Azure Pricing MCP Service Names

Exact names for the Azure Pricing MCP tool. Using wrong names returns
0 results.

| Azure Service       | Correct `service_name`          | Common SKUs                            |
| ------------------- | ------------------------------- | -------------------------------------- |
| AKS                 | `Azure Kubernetes Service`      | `Free`, `Standard`, `Premium`          |
| API Management      | `API Management`                | `Consumption`, `Developer`, `Standard` |
| App Insights        | `Application Insights`          | `Enterprise`, `Basic`                  |
| App Service         | `Azure App Service`             | `B1`, `S1`, `P1v3`, `P1v4`             |
| Application Gateway | `Application Gateway`           | `Standard_v2`, `WAF_v2`                |
| Azure Bastion       | `Azure Bastion`                 | `Basic`, `Standard`                    |
| Azure DNS           | `Azure DNS`                     | `Public`, `Private`                    |
| Azure Firewall      | `Azure Firewall`                | `Standard`, `Premium`                  |
| Azure Functions     | `Functions`                     | `Consumption`, `Premium`               |
| Azure Monitor       | `Azure Monitor`                 | `Logs`, `Metrics`                      |
| Container Apps      | `Azure Container Apps`          | `Consumption`                          |
| Container Instances | `Container Instances`           | `Standard`                             |
| Container Registry  | `Container Registry`            | `Basic`, `Standard`, `Premium`         |
| Cosmos DB           | `Azure Cosmos DB`               | `Serverless`, `Provisioned`            |
| Data Factory        | `Azure Data Factory v2`         | `Data Flow`, `Pipeline`                |
| Event Grid          | `Event Grid`                    | `Basic`                                |
| Event Hubs          | `Event Hubs`                    | `Basic`, `Standard`, `Premium`         |
| Front Door          | `Azure Front Door`              | `Standard`, `Premium`                  |
| Key Vault           | `Key Vault`                     | `Standard`                             |
| Load Balancer       | `Load Balancer`                 | `Basic`, `Standard`                    |
| Log Analytics       | `Log Analytics`                 | `Per GB`, `Commitment Tier`            |
| Logic Apps          | `Logic Apps`                    | `Consumption`, `Standard`              |
| MySQL Flexible      | `Azure Database for MySQL`      | `B1ms`, `D2ds_v4`, `E2ds_v4`           |
| NAT Gateway         | `NAT Gateway`                   | `Standard`                             |
| PostgreSQL Flexible | `Azure Database for PostgreSQL` | `B1ms`, `D2ds_v4`, `E2ds_v4`           |
| Redis Cache         | `Azure Cache for Redis`         | `Basic`, `Standard`, `Premium`         |
| SQL Database        | `SQL Database`                  | `Basic`, `S0`, `S1`, `Premium`         |
| Service Bus         | `Service Bus`                   | `Basic`, `Standard`, `Premium`         |
| Static Web Apps     | `Azure Static Web Apps`         | `Free`, `Standard`                     |
| Storage             | `Storage`                       | `Standard`, `Premium`, `LRS`, `GRS`    |
| VPN Gateway         | `VPN Gateway`                   | `Basic`, `VpnGw1`, `VpnGw2`            |
| Virtual Machines    | `Virtual Machines`              | `D4s_v5`, `B2s`, `E4s_v5`              |

- **DO**: Use exact names from the table above
- **DON'T**: Use "Azure SQL" (returns 0 results) — use "SQL Database"
- **DON'T**: Use "Web App" — use "Azure App Service"

## Bulk Estimates

For multi-resource cost estimates, prefer `azure_bulk_estimate` over
calling `azure_cost_estimate` per resource. It accepts a `resources`
array and returns aggregated totals.

Each resource supports a `quantity` parameter (default: 1) for
multi-instance scenarios. The default `response_format` is `compact`
in v5.0 — pass `response_format: "full"` only when you need the verbose
v4 string shape (e.g., for back-compat with a parser).
