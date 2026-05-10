---
name: entra-app-registration
description: '**WORKFLOW SKILL** — Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. WHEN: "create app registration", "register Azure AD app", "configure OAuth", "add API permissions", "generate service principal", "MSAL example", "Entra ID setup". USE FOR: app registration creation, OAuth + MSAL scaffolding, service principal generation. DO NOT USE FOR: Azure RBAC or role assignments (use azure-rbac), Key Vault secrets / certificate audits (use azure-compliance), Azure resource security scanning (use azure-compliance).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

## Overview

Microsoft Entra ID (formerly Azure AD) is Microsoft's cloud-based identity and access management service.

### Key Concepts

| Concept                     | Description                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| **App Registration**        | Configuration that allows an app to use Microsoft identity platform |
| **Application (Client) ID** | Unique identifier for your application                              |
| **Tenant ID**               | Unique identifier for your Azure AD tenant/directory                |
| **Client Secret**           | Password for the application (confidential clients only)            |
| **Redirect URI**            | URL where authentication responses are sent                         |
| **API Permissions**         | Access scopes your app requests                                     |
| **Service Principal**       | Identity created in your tenant when you register an app            |

### Application Types

| Type                      | Use Case                      |
| ------------------------- | ----------------------------- |
| **Web Application**       | Server-side apps, APIs        |
| **Single Page App (SPA)** | JavaScript/React/Angular apps |
| **Daemon/Service**        | Background services, APIs     |

## Rules

- **Prefer IaC** for managing app registrations when the project already uses IaC, scales to many apps, or needs audit history (see [`references/BICEP-EXAMPLE.bicep`](references/BICEP-EXAMPLE.bicep))
- **Prefer certificates or federated identity credentials over client secrets** in production environments
- **Store client secrets in Key Vault** — never commit them to source; rotate regularly; copy the value immediately on creation (only shown once)
- **Grant least-privilege API permissions** — add only the scopes the app actually uses
- **Out of scope**: Azure RBAC / role assignments (use `azure-rbac`); Key Vault audits (use `azure-compliance`); Azure resource security scanning (use `azure-compliance`)
- **CLI for ad-hoc**, **IaC for production** — see [`references/cli-commands.md`](references/cli-commands.md) for `az ad app create` patterns

## Core Workflow

Five-step procedure (full per-step detail in
[`references/core-workflow.md`](references/core-workflow.md)):

1. **Register the Application** — portal, CLI ([`cli-commands.md`](references/cli-commands.md)), or IaC ([`BICEP-EXAMPLE.bicep`](references/BICEP-EXAMPLE.bicep))
2. **Configure Authentication** — redirect URIs / token settings per app type (Web / SPA / Mobile / Service)
3. **Configure API Permissions** — Graph and custom-API scopes ([`api-permissions.md`](references/api-permissions.md))
4. **Create Client Credentials** — secret / certificate / federated identity (Key Vault for storage)
5. **Implement OAuth Flow** — code integration ([`oauth-flows.md`](references/oauth-flows.md), [`console-app-example.md`](references/console-app-example.md))

> **IaC preference**: when the project already uses IaC, manage app registrations through
> Bicep / Terraform for audit history and scale (see Step 1 reference).

## Common Patterns

### Pattern 1: First-Time App Registration

Walk user through their first app registration step-by-step.

**Required Information:**

- Application name
- Application type (web, SPA, mobile, service)
- Redirect URIs (if applicable)
- Required permissions

**Script:** See [references/first-app-registration.md](references/first-app-registration.md)

### Pattern 2: Console Application with User Authentication

Create a .NET/Python/Node.js console app that authenticates users.

**Required Information:**

- Programming language (C#, Python, JavaScript, etc.)
- Authentication library (MSAL recommended)
- Required permissions

**Example:** See [references/console-app-example.md](references/console-app-example.md)

### Pattern 3: Service-to-Service Authentication

Set up daemon/service authentication without user interaction.

**Required Information:**

- Service/app name
- Target API/resource
- Whether to use secret or certificate

**Implementation:** Use Client Credentials flow (see [references/oauth-flows.md#client-credentials-flow](references/oauth-flows.md#client-credentials-flow))

## MCP Tools and CLI

### Azure CLI Commands

| Command                      | Purpose                     |
| ---------------------------- | --------------------------- |
| `az ad app create`           | Create new app registration |
| `az ad app list`             | List app registrations      |
| `az ad app show`             | Show app details            |
| `az ad app permission add`   | Add API permission          |
| `az ad app credential reset` | Generate new client secret  |
| `az ad sp create`            | Create service principal    |

**Complete reference:** See [references/cli-commands.md](references/cli-commands.md)

### Microsoft Authentication Library (MSAL)

MSAL is the recommended library for integrating Microsoft identity platform.

**Supported Languages:**

- .NET/C# - `Microsoft.Identity.Client`
- JavaScript/TypeScript - `@azure/msal-browser`, `@azure/msal-node`
- Python - `msal`

**Examples:** See [references/console-app-example.md](references/console-app-example.md)

## Security Best Practices

Never hardcode secrets · Rotate secrets regularly · Use certificates over secrets in production ·
Least privilege API permissions · Enable MFA · Use managed identity for Azure-hosted apps ·
Validate tokens (issuer, audience, expiration) · HTTPS-only redirect URIs ·
Monitor sign-ins via Entra ID logs. See `references/auth-best-practices.md` for details.

## SDK Quick References

- **Azure Identity**: [Python](references/sdk/azure-identity-py.md) | [.NET](references/sdk/azure-identity-dotnet.md) | [TypeScript](references/sdk/azure-identity-ts.md) | [Java](references/sdk/azure-identity-java.md) | [Rust](references/sdk/azure-identity-rust.md)
- **Key Vault**: [Python](references/sdk/azure-keyvault-py.md) | [TypeScript](references/sdk/azure-keyvault-secrets-ts.md)

## References

- [OAuth Flows](references/oauth-flows.md) - Detailed OAuth 2.0 flow explanations
- [CLI Commands](references/cli-commands.md) - Azure CLI reference for app registrations
- [Console App Example](references/console-app-example.md) - Complete working examples
- [First App Registration](references/first-app-registration.md) - Step-by-step guide for beginners
- [API Permissions](references/api-permissions.md) - Understanding and configuring permissions
- [Troubleshooting](references/troubleshooting.md) - Common issues and solutions

## External Resources

- [Identity Platform](https://learn.microsoft.com/entra/identity-platform/) | [OAuth 2.0/OIDC](https://learn.microsoft.com/entra/identity-platform/v2-protocols) | [MSAL](https://learn.microsoft.com/entra/msal/) | [Graph API](https://learn.microsoft.com/graph/)

## Reference Index

| Reference                              | When to Load           |
| -------------------------------------- | ---------------------- |
| `references/api-permissions.md`        | Api Permissions        |
| `references/auth-best-practices.md`    | Auth Best Practices    |
| `references/cli-commands.md`           | Cli Commands           |
| `references/console-app-example.md`    | Console App Example    |
| `references/first-app-registration.md` | First App Registration |
| `references/oauth-flows.md`            | Oauth Flows            |
| `references/troubleshooting.md`        | Troubleshooting        |
