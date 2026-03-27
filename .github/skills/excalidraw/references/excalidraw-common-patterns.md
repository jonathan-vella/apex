<!-- ref:excalidraw-common-patterns-v1 -->

# Common Architecture Patterns — Excalidraw

Ready-to-use Excalidraw layout coordinates for common Azure architectures.
Each pattern provides icon positions and arrow connections that agents can adapt.

## How to Use

1. Create a new `.excalidraw` file with the base schema
2. Use `scripts/add-icon-to-diagram.py` to place Azure icons at the coordinates below
3. Use `scripts/add-arrow.py` to draw connections between resources
4. Adjust positioning (x, y coordinates) as needed
5. Update labels with actual resource names

## Pattern 1: Web Application (3-Tier)

App Gateway → Web App → SQL Database + Redis Cache + Blob Storage

### Layout

| Resource     | Icon Name             | X    | Y   | Label             |
| ------------ | --------------------- | ---- | --- | ----------------- |
| App Gateway  | Application-Gateway   | 100  | 300 | app-gw-prod       |
| Web App      | App-Service           | 400  | 300 | app-webapp-prod   |
| SQL Database | SQL-Database          | 700  | 200 | sql-webapp-prod   |
| Redis Cache  | Azure-Cache-for-Redis | 700  | 400 | redis-webapp-prod |
| Blob Storage | Storage-Accounts      | 1000 | 300 | st-webapp-prod    |

### Arrows

| From (x,y) | To (x,y)    | Label |
| ---------- | ----------- | ----- |
| (148, 324) | (400, 324)  | HTTPS |
| (448, 324) | (700, 224)  | SQL   |
| (448, 324) | (700, 424)  | Cache |
| (448, 324) | (1000, 324) | Blob  |

### Container

VNet rectangle: x=50, y=50, width=1100, height=500, fill=#e7f5ff

## Pattern 2: Hub-Spoke Network

Hub VNet with Firewall + DNS → Spoke VNets with workloads

### Layout

| Resource       | Icon Name           | X   | Y   | Label           |
| -------------- | ------------------- | --- | --- | --------------- |
| Azure Firewall | Azure-Firewall      | 500 | 200 | fw-hub-prod     |
| Private DNS    | Private-DNS-Zones   | 500 | 400 | dns-hub-prod    |
| Spoke 1 App    | App-Service         | 100 | 200 | app-spoke1-prod |
| Spoke 2 SQL    | SQL-Database        | 100 | 400 | sql-spoke2-prod |
| Spoke 3 AKS    | Kubernetes-Services | 900 | 200 | aks-spoke3-prod |

### Arrows

| From (x,y) | To (x,y)   | Label   | Style  |
| ---------- | ---------- | ------- | ------ |
| (148, 224) | (500, 224) | Peering | dashed |
| (148, 424) | (500, 424) | Peering | dashed |
| (748, 224) | (900, 224) | Peering | dashed |

## Pattern 3: Serverless Event-Driven

Event Grid → Function App → Cosmos DB + Service Bus

### Layout

| Resource     | Icon Name            | X   | Y   | Label               |
| ------------ | -------------------- | --- | --- | ------------------- |
| Event Grid   | Event-Grid-Topics    | 100 | 300 | evgt-events-prod    |
| Function App | Function-Apps        | 400 | 300 | func-processor-prod |
| Cosmos DB    | Azure-Cosmos-DB      | 700 | 200 | cosmos-data-prod    |
| Service Bus  | Service-Bus          | 700 | 400 | sb-queue-prod       |
| App Insights | Application-Insights | 400 | 550 | appi-monitor-prod   |

### Arrows

| From (x,y) | To (x,y)   | Label  |
| ---------- | ---------- | ------ |
| (148, 324) | (400, 324) | Events |
| (448, 324) | (700, 224) | Write  |
| (448, 324) | (700, 424) | Queue  |

Cross-cutting (no arrows): App Insights placed at bottom row.

## Base Excalidraw Template

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20
  },
  "files": {}
}
```

All text elements should use `fontFamily: 5` (Excalifont), `fontSize: 16`.
Arrows use `roundness: { "type": 2 }` for curved connections.
