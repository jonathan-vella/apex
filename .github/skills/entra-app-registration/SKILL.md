---
name: entra-app-registration
description: '**WORKFLOW SKILL** — Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. WHEN: "create app registration", "register Azure AD app", "configure OAuth", "add API permissions", "generate service principal", "MSAL example", "Entra ID setup". DO NOT USE FOR: Azure RBAC (azure-rbac), Key Vault audits (azure-compliance), resource security scanning (azure-compliance).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Entra App Registration

Microsoft Entra ID (formerly Azure AD) is Microsoft's cloud identity and
access-management service. This skill guides app registration, OAuth 2.0
flows, and MSAL integration.

For key concepts, application types, and the 3 common patterns (first-time
registration, console app with user auth, service-to-service), read
[`references/common-patterns.md`](references/common-patterns.md).

## Rules

- **Prefer IaC** for managing app registrations when the project uses IaC, scales to many apps, or needs audit history (see [`references/BICEP-EXAMPLE.bicep`](references/BICEP-EXAMPLE.bicep))
- **Prefer certificates or federated identity credentials over client secrets** in production
- **Store client secrets in Key Vault** — never commit them; rotate regularly; copy the value immediately on creation (only shown once)
- **Grant least-privilege API permissions** — only the scopes the app actually uses
- **CLI for ad-hoc**, **IaC for production** — see [`references/cli-commands.md`](references/cli-commands.md)
- **Out of scope**: Azure RBAC (azure-rbac), Key Vault audits (azure-compliance), resource security scanning (azure-compliance)

## Core Workflow

Five-step procedure (full per-step detail in
[`references/core-workflow.md`](references/core-workflow.md)):

1. **Register the Application** — portal, CLI ([`cli-commands.md`](references/cli-commands.md)), or IaC ([`BICEP-EXAMPLE.bicep`](references/BICEP-EXAMPLE.bicep))
2. **Configure Authentication** — redirect URIs / token settings per app type
3. **Configure API Permissions** — Graph and custom-API scopes ([`api-permissions.md`](references/api-permissions.md))
4. **Create Client Credentials** — secret / certificate / federated identity (Key Vault)
5. **Implement OAuth Flow** — code integration ([`oauth-flows.md`](references/oauth-flows.md), [`console-app-example.md`](references/console-app-example.md))

## Microsoft Authentication Library (MSAL)

Recommended library for integrating with the Microsoft identity platform:

- .NET / C# — `Microsoft.Identity.Client`
- JavaScript / TypeScript — `@azure/msal-browser`, `@azure/msal-node`
- Python — `msal`

Examples: [`references/console-app-example.md`](references/console-app-example.md).
SDK quick references in `references/sdk/` (azure-identity + key-vault, per language).

## Security Best Practices

Never hardcode secrets · rotate regularly · prefer certificates over secrets in
production · least-privilege API permissions · enable MFA · use managed
identity for Azure-hosted apps · validate tokens (issuer / audience /
expiration) · HTTPS-only redirect URIs (per the canonical
[security baseline](../../instructions/references/iac-security-baseline.md)) ·
monitor sign-ins via Entra ID logs.

Full details in
[`references/auth-best-practices.md`](references/auth-best-practices.md).

## Reference Index

| Reference                              | When to Load                                          |
| -------------------------------------- | ----------------------------------------------------- |
| `references/common-patterns.md`        | Key concepts, app types, 3 common registration patterns |
| `references/core-workflow.md`          | Full per-step procedure for app registration          |
| `references/api-permissions.md`        | Graph and custom-API permission configuration         |
| `references/auth-best-practices.md`    | Detailed security best practices                      |
| `references/cli-commands.md`           | Azure CLI reference for app registrations             |
| `references/console-app-example.md`    | Complete working code examples (multiple languages)   |
| `references/first-app-registration.md` | Step-by-step guide for beginners                      |
| `references/oauth-flows.md`            | Detailed OAuth 2.0 flow explanations                  |
| `references/troubleshooting.md`        | Common issues and solutions                           |
| `references/BICEP-EXAMPLE.bicep`       | Bicep template for IaC-managed app registration       |
| `references/sdk/*.md`                  | Language-specific SDK quick references                |
