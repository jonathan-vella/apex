<!-- ref:azure-patterns-v1 -->

# Azure Draw.io MCP Patterns

Reusable MCP tool call patterns for common Azure architectures.
Uses the simonkurtz-MSFT Draw.io MCP server tools.

## Hub-Spoke Network

```json
// Step 1: Search shapes
{ "queries": ["Virtual Networks", "Firewalls", "VPN Gateways", "Application Gateways"] }

// Step 2: Create groups for VNets
{ "groups": [
    { "text": "", "x": 50, "y": 60, "width": 400, "height": 300, "temp_id": "hub-vnet" },
    { "text": "", "x": 500, "y": 60, "width": 400, "height": 300, "temp_id": "spoke-vnet" }
]}

// Step 3: Add cells — group labels + icons + peering edge
{ "cells": [
    { "type": "vertex", "x": 50, "y": 30, "width": 400, "height": 20, "text": "vnet-hub-prod (10.0.0.0/16)", "style": "text;fontSize=12;fontStyle=1;" },
    { "type": "vertex", "x": 500, "y": 30, "width": 400, "height": 20, "text": "vnet-spoke-prod (10.1.0.0/16)", "style": "text;fontSize=12;fontStyle=1;" },
    { "type": "vertex", "shape_name": "Firewalls", "x": 200, "y": 150, "text": "Azure Firewall", "temp_id": "fw" },
    { "type": "vertex", "shape_name": "Application Gateways", "x": 650, "y": 150, "text": "App Gateway", "temp_id": "appgw" },
    { "type": "edge", "source_id": "hub-vnet", "target_id": "spoke-vnet", "text": "VNet Peering" }
]}
```

## Private Endpoint Pattern

```json
// Subnet group inside VNet
{ "groups": [
    { "text": "", "x": 60, "y": 200, "width": 260, "height": 100, "temp_id": "snet-pe" }
]}

// PE icon + private link edge
{ "cells": [
    { "type": "vertex", "shape_name": "Private Endpoints", "x": 100, "y": 220, "text": "PE: SQL", "temp_id": "pe-sql" },
    { "type": "edge", "source_id": "pe-sql", "target_id": "sql-db", "text": "Private Link", "style": "dashed=1;" }
]}
```

## Cross-Cutting Services (Bottom Band)

```json
// All cross-cutting in ONE add-cells call, 100px apart, 120px below main flow
{
  "cells": [
    {
      "type": "vertex",
      "shape_name": "Monitor",
      "x": 50,
      "y": 450,
      "text": "Azure Monitor"
    },
    {
      "type": "vertex",
      "shape_name": "Key Vaults",
      "x": 150,
      "y": 450,
      "text": "Key Vault"
    },
    {
      "type": "vertex",
      "shape_name": "Azure Active Directory",
      "x": 250,
      "y": 450,
      "text": "Entra ID"
    },
    {
      "type": "vertex",
      "shape_name": "Azure Policy",
      "x": 350,
      "y": 450,
      "text": "Azure Policy"
    },
    {
      "type": "vertex",
      "shape_name": "Container Registries",
      "x": 450,
      "y": 450,
      "text": "ACR"
    },
    {
      "type": "vertex",
      "shape_name": "DNS Zones",
      "x": 550,
      "y": 450,
      "text": "Private DNS"
    },
    {
      "type": "vertex",
      "shape_name": "Application Insights",
      "x": 650,
      "y": 450,
      "text": "App Insights"
    }
  ]
}
// NOTE: No edges to cross-cutting services — their presence is implied
```

## App Service with Background Processing

```json
// Group for App Service Plan
{ "groups": [
    { "text": "", "x": 300, "y": 60, "width": 180, "height": 200, "temp_id": "asp" }
]}

// Icons inside
{ "cells": [
    { "type": "vertex", "x": 300, "y": 30, "width": 180, "height": 20, "text": "App Service Plan", "style": "text;fontSize=12;fontStyle=1;" },
    { "type": "vertex", "shape_name": "App Services", "x": 350, "y": 100, "text": "Web App", "temp_id": "webapp" },
    { "type": "vertex", "shape_name": "Function Apps", "x": 350, "y": 180, "text": "Function App", "temp_id": "func" },
    { "type": "edge", "source_id": "webapp", "target_id": "func", "text": "Queue Trigger" }
]}
```

## Edge Conventions (Reference)

Edges are added in `add-cells` with `type: "edge"`. Do NOT set anchor points
(`entryX/exitX` etc.) — the server auto-calculates optimal routing.

| Flow                   | Style override                   |
| ---------------------- | -------------------------------- |
| Primary data flow      | _(default — no style needed)_    |
| Monitoring/diagnostics | `"style": "dashed=1;"`           |
| HTTPS traffic          | `"text": "HTTPS"`                |
| Bidirectional          | `"style": "startArrow=classic;"` |
