---
title: "Functional Requirements"
sidebar:
  order: 2
---

## 🚀 Functional Requirements

### Core Capabilities

| #   | Capability                     | Priority  | Acceptance Criteria                                                             |
| --- | ------------------------------ | --------- | ------------------------------------------------------------------------------- |
| 1   | Web-based order management     | 🔴 Must   | Orders from web portal accepted, validated, and stored with <1% error rate      |
| 2   | Real-time inventory from farms | 🔴 Must   | Farmer stock levels reflected within 5 min; overselling blocked automatically   |
| 3   | Delivery route optimization    | 🔴 Must   | Routes generated automatically; reduce wasted driver trips by >50%              |
| 4   | Restaurant order tracking      | 🔴 Must   | Restaurants can view order status and ETA in real time via web portal           |
| 5   | Consumer order placement       | 🟡 Should | Consumers can browse and order produce via web portal                           |
| 6   | Analytics dashboard            | 🟡 Should | Business reports showing order volume, revenue trends, delivery performance     |
| 7   | Mobile app API support         | 🟢 Could  | REST API endpoints designed to support future mobile app                        |
| 8   | Seasonal auto-scaling          | 🔴 Must   | Platform handles 3× order volume during summer and December without degradation |

### User Types

| User Type        | Description                                 | Est. Count | Access Level |
| ---------------- | ------------------------------------------- | ---------- | ------------ |
| Restaurant Staff | Place orders, track deliveries, view menu   | 500+       | Contributor  |
| Consumer         | Browse products, place orders               | 10,000     | Reader       |
| Farm Operator    | Update inventory, confirm produce readiness | 50-100     | Contributor  |
| Delivery Driver  | View routes, confirm pickups/deliveries     | 20-50      | Reader       |
| Operations Admin | Manage platform, view analytics, configure  | 5-10       | Admin        |

### Integrations

| System                    | Direction | Protocol | Auth Method | SLA   | EU Data Residency Required |
| ------------------------- | --------- | -------- | ----------- | ----- | -------------------------- |
| Payment Gateway           | Outbound  | REST     | API Key     | 99.9% | Yes — PII/payment tokens   |
| Mapping/Routing API       | Outbound  | REST     | API Key     | 99.5% | Yes — address data         |
| Email/SMS Notifications   | Outbound  | REST     | API Key     | 99.0% | Yes — PII (names, emails)  |
| Farm Inventory API        | Inbound   | REST     | OAuth 2.0   | 99.0% | Yes — supply chain data    |
| Social Identity Providers | Outbound  | OIDC     | OAuth 2.0   | 99.9% | Yes — PII (email, profile) |

> [!IMPORTANT]
> All external processors handling EU personal data MUST store and process
> data within the EU, or operate under an approved GDPR transfer mechanism
> (e.g., Standard Contractual Clauses). The Architect must validate processor
> compliance during Step 2.

### Data Types

| Category             | Sensitivity | Est. Volume     | Retention | Residency |
| -------------------- | ----------- | --------------- | --------- | --------- |
| Customer PII         | 🔴 High     | 10K+ records    | 3 years   | EU only   |
| Payment tokens       | 🔴 High     | 1K+ daily       | Per PCI   | EU only   |
| Order data           | 🟡 Medium   | 500+ orders/day | 2 years   | EU only   |
| Inventory levels     | 🟢 Low      | Updated hourly  | 90 days   | EU only   |
| Delivery route data  | 🟡 Medium   | 50+ routes/day  | 1 year    | EU only   |
| Analytics/aggregates | 🟢 Low      | Derived daily   | 2 years   | EU        |

### Architecture Pattern

| Field              | Value                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Workload Pattern   | N-Tier Web Application                                                                                    |
| Recommended Option | App Service + Azure SQL + Key Vault + Application Insights + Storage Account (SKUs to be sized in Step 2) |
| Tier               | Cost-Optimized                                                                                            |
| Justification      | Startup budget (<€1K/month), <100 concurrent users at MVP launch, greenfield build, Dev + Prod envs       |

> [!NOTE]
> Step 1 intentionally avoids prescribing SKUs. Step 2 (Architecture) must
> validate platform tiers against concurrency, autoscale, background processing,
> caching, and seasonal 3× peak load requirements.
