<!-- ref:service-matrices-v1 -->

# Service Recommendation Matrix

## Workload Patterns

| Pattern           | Cost-Optimized Tier        | Balanced Tier                    | Enterprise Tier                         |
| ----------------- | -------------------------- | -------------------------------- | --------------------------------------- |
| **Static Site**   | SWA Free + Blob            | SWA Std + CDN + KV               | SWA Std + FD + KV + Monitor             |
| **API-First**     | App Svc B1 + SQL Basic     | App Svc S1 + SQL S1 + KV         | App Svc P1v3 + SQL Premium + APIM       |
| **N-Tier Web**    | App Svc B1 + SQL Basic     | App Svc S1 + SQL S1 + Redis + KV | App Svc P1v4 + SQL Premium + Redis + FD |
| **Serverless**    | Functions Consumption      | Functions Premium + CosmosDB     | Functions Premium + CosmosDB + APIM     |
| **Container**     | Container Apps Consumption | Container Apps + ACR + KV        | AKS + ACR + KV + Monitor                |
| **Data Platform** | SQL Basic + Blob           | Synapse Serverless + ADLS        | Synapse Dedicated + ADLS + Purview      |

## Detection Signals

Map user language to workload pattern:

| User Says                              | Likely Pattern |
| -------------------------------------- | -------------- |
| "website", "landing page", "blog"      | Static Site    |
| "REST API", "microservices", "backend" | API-First      |
| "web app", "portal", "dashboard"       | N-Tier Web     |
| "event-driven", "triggers", "webhooks" | Serverless     |
| "Docker", "Kubernetes", "containers"   | Container      |
| "analytics", "data warehouse", "ETL"   | Data Platform  |

## Business Domain Signals

| Industry          | Common Compliance | Default Security                      |
| ----------------- | ----------------- | ------------------------------------- |
| Healthcare        | HIPAA             | Private endpoints, encryption at rest |
| Financial         | PCI-DSS, SOC 2    | WAF, private endpoints, audit logging |
| Government        | FedRAMP, IL4/5    | Azure Gov, private endpoints          |
| Retail/E-commerce | PCI-DSS           | WAF, DDoS protection                  |
| Education         | FERPA             | Data residency, access controls       |

## Company Size Heuristics

| Size                | Budget Signal  | Default Tier   | Security Posture       |
| ------------------- | -------------- | -------------- | ---------------------- |
| Startup (<50)       | "$50-200/mo"   | Cost-Optimized | Basic managed identity |
| Mid-Market (50-500) | "$500-2000/mo" | Balanced       | Private endpoints, KV  |
| Enterprise (500+)   | "$2000+/mo"    | Enterprise     | Full WAF compliance    |

## Industry Compliance Pre-Selection

| Industry   | Auto-Select                       |
| ---------- | --------------------------------- |
| Healthcare | HIPAA checkbox, private endpoints |
| Finance    | PCI-DSS + SOC 2, WAF required     |
| Government | Data residency, enhanced audit    |
| Retail     | PCI-DSS if payments, DDoS         |
