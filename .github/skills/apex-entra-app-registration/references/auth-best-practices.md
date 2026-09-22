<!-- ref:auth-best-practices-v1 -->

# Azure Authentication Best Practices

> Source: [Microsoft — Passwordless connections for Azure services](https://learn.microsoft.com/azure/developer/intro/passwordless-overview) and [Azure Identity client libraries](https://learn.microsoft.com/dotnet/azure/sdk/authentication/).

## Golden Rule

Use **managed identities** and **Azure RBAC** in production. Reserve `DefaultAzureCredential` for **local development only**.

## Identity And Permission Boundary

Before authentication, bind the intended tenant, client/application ID, principal,
resource/audience, flow and scope to the user's request. Reuse an approved context;
do not sign in, switch identity or grant consent merely to make a probe succeed.
Never return access tokens, refresh tokens, client secrets, private keys or secret
values through chat, tool results, diagnostics or external token-decoding sites.

Azure CLI interactive login authenticates the Azure CLI application, not an arbitrary
`CLIENT_ID` variable. Test a registration with MSAL configured with that actual client
ID and tenant; use [console examples](console-app-example.md) for the selected flow.
Report only success, expiry and redacted identity/permission metadata, never raw tokens.
If the required SDK/version or flow is unavailable, report the blocker; do not silently
substitute a different client, credential, SDK or permission model.

| Access model | Permission and endpoint contract |
| --- | --- |
| Delegated user | Consented delegated scopes; Graph `/me` requires a signed-in user |
| App-only | Application permissions with admin consent and `.default`; Graph `/users/{id}` needs an explicit target and suitable application permission, never `/me` |
| Azure resource | Azure RBAC at the intended resource scope; Graph consent is independent |
| Key Vault audit | Metadata-only listing; no secret-value read permission needed or requested |

Credential rotation follows the [additive credential procedure](cli-commands.md#client-credentials-secrets--certificates).
New credentials preserve existing credentials until consumer validation and separate
retirement approval. Generated setup/consent/assignment instructions are not execution
approval, for generic users or APEX workflows alike.

## Authentication by Environment

| Environment                   | Recommended Credential                                        | Why                                                             |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| **Production (Azure-hosted)** | `ManagedIdentityCredential` (system- or user-assigned)        | No secrets to manage; auto-rotated by Azure                     |
| **Production (on-premises)**  | `ClientCertificateCredential` or `WorkloadIdentityCredential` | Deterministic; no fallback chain overhead                       |
| **CI/CD pipelines**           | `AzurePipelinesCredential` / `WorkloadIdentityCredential`     | Scoped to pipeline identity                                     |
| **Local development**         | `DefaultAzureCredential`                                      | Chains CLI, PowerShell, and VS Code credentials for convenience |

## Why Not `DefaultAzureCredential` in Production?

1. **Unpredictable fallback chain** — walks through multiple credential types, adding latency and making failures harder to diagnose.
2. **Broad surface area** — checks environment variables, CLI tokens, and other sources that should not exist in production.
3. **Non-deterministic** — which credential actually authenticates depends on the environment, making behavior inconsistent across deployments.
4. **Performance** — each failed credential attempt adds network round-trips before falling back to the next.

## Production Patterns

### .NET

```csharp
using Azure.Identity;

var credential = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") == "Development"
    ? new DefaultAzureCredential()                          // local dev — uses CLI/VS credentials
    : new ManagedIdentityCredential();                      // production — deterministic, no fallback chain
// For user-assigned identity: new ManagedIdentityCredential("<client-id>")
```

### TypeScript / JavaScript

```typescript
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

const credential =
  process.env.NODE_ENV === "development"
    ? new DefaultAzureCredential() // local dev — uses CLI/VS credentials
    : new ManagedIdentityCredential(); // production — deterministic, no fallback chain
// For user-assigned identity: new ManagedIdentityCredential("<client-id>")
```

### Python

```python
import os
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

credential = (
    DefaultAzureCredential()                              # local dev — uses CLI/VS credentials
    if os.getenv("AZURE_FUNCTIONS_ENVIRONMENT") == "Development"
    else ManagedIdentityCredential()                      # production — deterministic, no fallback chain
)
# For user-assigned identity: ManagedIdentityCredential(client_id="<client-id>")
```

### Java

```java
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.identity.ManagedIdentityCredentialBuilder;

var credential = "Development".equals(System.getenv("AZURE_FUNCTIONS_ENVIRONMENT"))
    ? new DefaultAzureCredentialBuilder().build()          // local dev — uses CLI/VS credentials
    : new ManagedIdentityCredentialBuilder().build();      // production — deterministic, no fallback chain
// For user-assigned identity: new ManagedIdentityCredentialBuilder().clientId("<client-id>").build()
```

## Local Development Setup

`DefaultAzureCredential` is ideal for local dev because it automatically picks up credentials from developer tools:

1. **Azure CLI** — `az login`
2. **Azure Developer CLI** — `azd auth login`
3. **Azure PowerShell** — `Connect-AzAccount`
4. **Visual Studio / VS Code** — sign in via Azure extension

```typescript
import { DefaultAzureCredential } from "@azure/identity";

// Local development only — uses CLI/PowerShell/VS Code credentials
const credential = new DefaultAzureCredential();
```

## Environment-Aware Pattern

Detect the runtime environment and select the appropriate credential. The key principle: use `DefaultAzureCredential` only when running locally, and a specific credential in production.

> **Tip:** Azure Functions sets `AZURE_FUNCTIONS_ENVIRONMENT` to `"Development"` when running locally. For App Service or containers, use any environment variable you control (e.g. `NODE_ENV`, `ASPNETCORE_ENVIRONMENT`).

```typescript
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

function getCredential() {
  if (process.env.NODE_ENV === "development") {
    return new DefaultAzureCredential(); // picks up az login / VS Code creds
  }
  return process.env.AZURE_CLIENT_ID
    ? new ManagedIdentityCredential(process.env.AZURE_CLIENT_ID) // user-assigned
    : new ManagedIdentityCredential(); // system-assigned
}
```

## Security Checklist

- [ ] Use managed identity for all Azure-hosted apps
- [ ] Never hardcode credentials, connection strings, or keys
- [ ] Apply least-privilege RBAC roles at the narrowest scope
- [ ] Use `ManagedIdentityCredential` (not `DefaultAzureCredential`) in production
- [ ] Store any required secrets in Azure Key Vault
- [ ] Rotate secrets and certificates on a schedule
- [ ] Enable Microsoft Defender for Cloud on production resources

## Further Reading

- [Passwordless connections overview](https://learn.microsoft.com/azure/developer/intro/passwordless-overview)
- [Managed identities overview](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
- [Azure RBAC overview](https://learn.microsoft.com/azure/role-based-access-control/overview)
- [.NET authentication guide](https://learn.microsoft.com/dotnet/azure/sdk/authentication/)
- [Python identity library](https://learn.microsoft.com/python/api/overview/azure/identity-readme)
- [JavaScript identity library](https://learn.microsoft.com/javascript/api/overview/azure/identity-readme)
- [Java identity library](https://learn.microsoft.com/java/api/overview/azure/identity-readme)
