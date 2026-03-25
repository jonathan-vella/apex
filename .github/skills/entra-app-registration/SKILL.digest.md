<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Overview

Microsoft Entra ID (formerly Azure AD) is Microsoft's cloud-based identity and access management service.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **App Registration** | Configuration that allows an app to use Microsoft identity platform |
| **Application (Client) ID** | Unique identifier for your application |
| **Tenant ID** | Unique identifier for your Azure AD tenant/directory |

> _See SKILL.md for full content._

## Core Workflow

### Step 1: Register the Application

Create an app registration in the Azure portal or using Azure CLI.

**Portal Method:**

1. Navigate to Azure Portal → Microsoft Entra ID → App registrations
2. Click "New registration"
3. Provide name, supported account types, and redirect URI

> _See SKILL.md for full content._

## Common Patterns

### Pattern 1: First-Time App Registration

Walk user through their first app registration step-by-step.

**Required Information:**

- Application name
- Application type (web, SPA, mobile, service)
- Redirect URIs (if applicable)

> _See SKILL.md for full content._

## MCP Tools and CLI

### Azure CLI Commands

| Command                      | Purpose                     |
| ---------------------------- | --------------------------- |
| `az ad app create`           | Create new app registration |
| `az ad app list`             | List app registrations      |
| `az ad app show`             | Show app details            |
| `az ad app permission add`   | Add API permission          |
| `az ad app credential reset` | Generate new client secret  |

> _See SKILL.md for full content._

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

| Reference | When to Load |
|-----------|-------------|
| `references/api-permissions.md` | Api Permissions |
| `references/auth-best-practices.md` | Auth Best Practices |
| `references/cli-commands.md` | Cli Commands |
| `references/console-app-example.md` | Console App Example |
| `references/first-app-registration.md` | First App Registration |
| `references/oauth-flows.md` | Oauth Flows |
| `references/troubleshooting.md` | Troubleshooting |

> _See SKILL.md for full content._
