# Key Vault Secrets — TypeScript SDK Quick Reference

> Condensed from **azure-keyvault-secrets-ts**. Full patterns (secret versions,
> expiration metadata, soft-delete and recovery)
> in the **azure-keyvault-secrets-ts** plugin skill if installed.

## Install

npm install @azure/keyvault-secrets @azure/identity

## Quick Start

```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
const client = new SecretClient("https://<vault>.vault.azure.net", new DefaultAzureCredential());

for await (const properties of client.listPropertiesOfSecrets()) {
  console.log({
    name: properties.name,
    enabled: properties.enabled,
    expiresOn: properties.expiresOn,
  });
}
```

This is a local-development metadata audit using the `@azure/keyvault-secrets` 4.x
API family. Verify `SecretClient.listPropertiesOfSecrets` against the installed
package version before use; no SDK installation or live service test is implied.
For version coverage use `listPropertiesOfSecretVersions(name)` and report denied
or incomplete coverage. Neither operation retrieves secret values. Never use
`getSecret` for an expiration audit or log whole SDK responses/errors.

## Best Practices

- Use DefaultAzureCredential for **local development only**. In production, use ManagedIdentityCredential — see [auth-best-practices.md](../../../apex-entra-app-registration/references/auth-best-practices.md)
- Enable soft-delete — required for production vaults
- Set secret expiration metadata according to policy; changing metadata requires approval
- Rotate secrets through their issuing system and update consumers before retiring old versions
- Grant metadata-only audit access; secret-value retrieval is a separate permission and task
- Browser not supported — these SDKs are Node.js only
