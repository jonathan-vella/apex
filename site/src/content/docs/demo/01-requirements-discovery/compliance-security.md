---
title: "Compliance & Security"
sidebar:
  order: 3
---

## 🔒 Compliance & Security Requirements

### Regulatory Frameworks

| Requirement             | Applicability | Notes                                                          |
| ----------------------- | ------------- | -------------------------------------------------------------- |
| Cardholder data storage | No            | Payment tokens only — PCI scope minimized via external gateway |
| Network segmentation    | Yes           | Private endpoints for data services                            |
| Encryption requirements | Yes           | TLS 1.2+ in transit, platform-managed encryption at rest       |

| Trust Principle | Applicability | Notes                |
| --------------- | ------------- | -------------------- |
| Security        | No            | Not required for MVP |
| Availability    | No            | Not required for MVP |
| Confidentiality | No            | Not required for MVP |

| Requirement   | Applicability | Notes                    |
| ------------- | ------------- | ------------------------ |
| PHI handling  | No            | No health data processed |
| BAA required  | No            | N/A                      |
| Audit logging | No            | N/A                      |

| Requirement      | Applicability | Notes                                                      |
| ---------------- | ------------- | ---------------------------------------------------------- |
| EU data subjects | Yes           | All customers are EU residents (Scandinavia)               |
| Data residency   | Yes           | All data must reside in EU regions (swedencentral primary) |
| Right to erasure | Yes           | Must support GDPR Article 17 — customer data deletion      |

| Control Area        | Applicability | Notes                |
| ------------------- | ------------- | -------------------- |
| Access control      | No            | Not required for MVP |
| Asset management    | No            | Not required for MVP |
| Incident management | No            | Not required for MVP |

### Data Residency

| Requirement              | Value                                      |
| ------------------------ | ------------------------------------------ |
| Primary Region           | swedencentral                              |
| Data Sovereignty         | EU-only (GDPR compliance)                  |
| Cross-region Replication | Not required (relaxed recovery objectives) |

### Environment Isolation

| Boundary        | Dev                     | Production                         |
| --------------- | ----------------------- | ---------------------------------- |
| Identity tenant | Separate Entra config   | Separate Entra config              |
| Secrets (KV)    | Dedicated Key Vault     | Dedicated Key Vault                |
| Data stores     | Separate SQL + Storage  | Separate SQL + Storage             |
| Diagnostics     | Separate Log Analytics  | Separate Log Analytics             |
| Budget alert    | Separate budget scope   | Separate budget scope              |
| Network         | Shared or separate VNet | Dedicated VNet + private endpoints |

### Authentication & Authorization

| Requirement       | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Identity Provider | Microsoft Entra External ID (consumers + restaurants) + Social providers |
| MFA Requirement   | Conditional (required for admin users)                                   |
| RBAC Model        | Application-level (role per user type)                                   |

> [!NOTE]
> Azure AD B2C is end-of-sale for new tenants since May 2025. Microsoft Entra
> External ID is the successor for greenfield consumer-facing identity.

### Network Security

| Control                     | Required | Notes                                              |
| --------------------------- | -------- | -------------------------------------------------- |
| Private endpoints           | ✅       | For Azure SQL and Storage Account                  |
| VNet integration            | ✅       | App Service VNet integration for SQL access        |
| Public endpoints acceptable | ✅       | Web frontend and API (behind App Service)          |
| WAF required                | ❌       | Not required for MVP — compensating controls below |

### Recommended Security Controls

| Control               | Recommended | User Confirmed | Notes                                            |
| --------------------- | ----------- | -------------- | ------------------------------------------------ |
| Managed Identity      | Yes         | Yes            | Prefer over keys for service-to-service          |
| Private Endpoints     | Yes         | Yes            | For Azure SQL and Storage Account                |
| WAF                   | No          | No             | Not required for MVP — add post-launch           |
| Key Vault for Secrets | Yes         | Yes            | Centralized secrets management                   |
| Diagnostic Settings   | Yes         | Yes            | Application Insights + Log Analytics             |
| TLS 1.2 Minimum       | Yes         | Yes            | Always recommended — security baseline           |
| Encryption at Rest    | Yes         | Yes            | Platform-managed encryption                      |
| Network Isolation     | Yes         | Yes            | VNet integration + private endpoints             |
| Edge Rate Limiting    | Yes         | Yes            | App Service built-in or API Management tier      |
| API Throttling        | Yes         | Yes            | Per-client rate limits on order/inventory APIs   |
| Bot Protection        | Yes         | Yes            | Basic bot detection on login and order endpoints |
