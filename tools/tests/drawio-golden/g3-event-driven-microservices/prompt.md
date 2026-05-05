# G3 — Event-Driven Microservices

Generate a sequence / runtime-flow diagram for an order-processing system.

## Resources

- API Management (Consumption tier) — public ingress
- Container App: `orders-api` (HTTP triggered)
- Container App: `orders-worker` (Service Bus triggered)
- Container App: `notifications-worker` (Event Grid triggered)
- Service Bus namespace (Standard) with topic `orders` + 2 subscriptions
- Event Grid system topic for Cosmos DB change feed
- Azure Cosmos DB for NoSQL (Serverless)
- Azure Cache for Redis (Standard C1)
- Container Apps Environment + Log Analytics workspace
- Application Insights

## Flow

1. Client → APIM → `orders-api` (`HTTPS`, `OAuth2`).
2. `orders-api` writes to Cosmos DB (`HTTPS`, `443`) and publishes to Service
   Bus topic `orders` (`AMQP`).
3. `orders-worker` receives from `orders` subscription (`AMQP`), reads from
   Redis cache (`6380 TLS`), writes back to Cosmos DB.
4. Cosmos DB change feed → Event Grid → `notifications-worker`.

## Diagram expectations

- **Type:** sequence (runtime flow), NOT network topology.
- **Zones:** logical — `Ingress`, `Processing`, `Persistence` (NOT VNets).
- **Edge labels:** every edge carries protocol + (port or auth method).
- **Legend:** NOT required for sequence type (per T-022 carve-out).
