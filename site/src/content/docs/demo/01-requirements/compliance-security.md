---
title: "Compliance & Security"
description: "Regulatory frameworks, data residency, authentication, and network security requirements for the Malta catering app"
sidebar:
  order: 3
---

## Regulatory Frameworks

### GDPR — Applicable

| Requirement      | Applicability | Notes                                            |
| ---------------- | ------------- | ------------------------------------------------ |
| EU data subjects | Yes           | Malta-based customers (EU citizens)              |
| Data residency   | Yes           | All data stored in swedencentral (EU)            |
| Right to erasure | Yes           | Must support deletion of customer PII on request |

### PCI-DSS — Not Applicable

Payment is strictly cash on delivery — no cardholder data is stored, processed,
or transmitted. No network segmentation or encryption requirements under PCI-DSS.

### SOC 2 — Not Applicable

Not required for this scope. A basic SLA is sufficient; no SOC 2 audit is planned.

### HIPAA — Not Applicable

No health data is handled. No BAA or HIPAA-specific audit logging required.

### ISO 27001 — Not Applicable

Not required for this scope. The environment is simple with a best-effort support model.

## Data Residency

| Requirement              | Value         |
| ------------------------ | ------------- |
| Primary Region           | swedencentral |
| Data Sovereignty         | EU-only       |
| Cross-region Replication | Not required  |

## Authentication & Authorization

| Requirement       | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| Identity Provider | Social IdPs via App Service Authentication (Easy Auth) |
| MFA Requirement   | Not required                                           |
| RBAC Model        | Application-level (staff vs customer)                  |

## Network Security

| Control                     | Required | Notes                                                     |
| --------------------------- | -------- | --------------------------------------------------------- |
| Private endpoints           | ✅       | Key Vault, Storage, ACR via VNet                          |
| VNet integration            | ✅       | App Service S1 with VNet integration                      |
| Public endpoints acceptable | ✅       | App Service public inbound only; backend services private |
| WAF required                | ❌       | Not justified for < 1K concurrent users                   |

## Recommended Security Controls

| Control               | Recommended | User Confirmed | Notes                                        |
| --------------------- | ----------- | -------------- | -------------------------------------------- |
| Managed Identity      | Yes         | Yes            | App Service to Key Vault, Storage, and ACR   |
| Private Endpoints     | Yes         | Yes            | Key Vault, Storage Account, ACR via VNet PE  |
| WAF                   | No          | No             | Low traffic; not cost-justified              |
| Key Vault for Secrets | Yes         | Yes            | Store storage connection strings securely    |
| Diagnostic Settings   | Yes         | —              | Basic logging to Log Analytics (recommended) |
| TLS 1.2 Minimum       | Yes         | Yes            | Enforced on all endpoints                    |
| Encryption at Rest    | Yes         | —              | Platform-managed (Azure default)             |
| Network Isolation     | Yes         | Yes            | VNet integration with private endpoints      |
