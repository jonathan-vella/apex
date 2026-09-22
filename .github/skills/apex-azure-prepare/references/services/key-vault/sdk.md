# Key Vault - SDK Patterns

## Node.js

> **Auth:** `DefaultAzureCredential` is for local development. See [auth-best-practices.md](../../../../apex-entra-app-registration/references/auth-best-practices.md) for production patterns.

```javascript
const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

const client = new SecretClient(process.env.KEY_VAULT_URL, new DefaultAzureCredential());

const secret = await client.getSecret("database-connection-string");
if (!secret.value) throw new Error("Required database secret is unavailable");
```

## Python

> **Auth:** `DefaultAzureCredential` is for local development. See [auth-best-practices.md](../../../../apex-entra-app-registration/references/auth-best-practices.md) for production patterns.

```python
import os
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

client = SecretClient(
    vault_url=os.environ["KEY_VAULT_URL"],
    credential=DefaultAzureCredential()
)

secret = client.get_secret("database-connection-string")
if not secret.value:
  raise RuntimeError("Required database secret is unavailable")
```

## .NET

> **Auth:** `DefaultAzureCredential` is for local development. See [auth-best-practices.md](../../../../apex-entra-app-registration/references/auth-best-practices.md) for production patterns.

```csharp
var client = new SecretClient(
    new Uri(Environment.GetEnvironmentVariable("KEY_VAULT_URL")),
    new DefaultAzureCredential()
);

KeyVaultSecret secret = await client.GetSecretAsync("database-connection-string");
if (string.IsNullOrWhiteSpace(secret.Value))
  throw new InvalidOperationException("Required database secret is unavailable");
```

Pass the value directly to the consuming client in memory. Never print it, include it in errors,
or place it in a plan, transcript or output artifact. Metadata audits must list metadata, not fetch values.

## Event Grid Integration (Expiry Notifications)

```bicep
resource kvEventSubscription 'Microsoft.EventGrid/eventSubscriptions@2023-12-15-preview' = {
  name: 'secret-expiry-notification'
  scope: keyVault
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: 'https://my-api.example.com/secret-rotation'
      }
    }
    filter: {
      includedEventTypes: [
        'Microsoft.KeyVault.SecretNearExpiry'
        'Microsoft.KeyVault.SecretExpired'
      ]
    }
  }
}
```
