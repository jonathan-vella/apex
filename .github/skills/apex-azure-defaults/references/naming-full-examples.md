<!-- ref:naming-full-examples-v1 -->

# Naming Conventions — Extended Reference

## Length-Constrained Resources

Key Vault and Storage Account have 24-char limits. Always include
`uniqueSuffix`:

```bicep
// Key Vault: kv-{8chars}-{3chars}-{6chars} = 21 chars max
var kvName = 'kv-${take(projectName, 8)}-${take(environment, 3)}-${take(uniqueSuffix, 6)}'

// Storage: st{8chars}{3chars}{6chars} = 19 chars max (no hyphens!)
var stName = 'st${take(replace(projectName, '-', ''), 8)}${take(environment, 3)}${take(uniqueSuffix, 6)}'
```

## Naming Rules

- **DO**: Use lowercase with hyphens (`kv-myapp-dev-abc123`)
- **DO**: Include `uniqueSuffix` in globally unique names
  (Key Vault, Storage, SQL Server)
- **DO**: Use `take()` to truncate long names within limits
- **DON'T**: Use hyphens in Storage Account names
  (only lowercase + numbers)
- **DON'T**: Hardcode unique values — always derive from
  `uniqueString(resourceGroup().id)`
- **DON'T**: Exceed max length — Bicep won't warn, deployment
  will fail

## Extended Abbreviations

Additional resources beyond the core CAF table:

| Resource               | Abbreviation | Name Pattern                 | Max |
| ---------------------- | ------------ | ---------------------------- | --- |
| Container App          | `ca`         | `ca-{project}-{env}`         | 32  |
| Container Env          | `cae`        | `cae-{project}-{env}`        | 60  |
| Cosmos DB              | `cosmos`     | `cosmos-{project}-{env}`     | 44  |
| Service Bus            | `sb`         | `sb-{project}-{env}`         | 50  |
| Private DNS Zone       | (varies)     | `privatelink.{service}.core` | 63  |
| User-Assigned Identity | `id`         | `id-{project}-{env}`         | 128 |
| API Management         | `apim`       | `apim-{project}-{env}`       | 50  |
| Container Registry     | `acr`        | `acr{project}{env}{suffix}`  | 50  |
| Event Hub              | `evh`        | `evh-{project}-{env}`        | 50  |
