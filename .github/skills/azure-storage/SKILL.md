---
name: azure-storage
description: '**UTILITY SKILL** — Azure Storage Services: Blob, File Shares, Queue, Table, and Data Lake. Object storage, SMB shares, async messaging, NoSQL key-value, big-data analytics. Access tiers + lifecycle management. WHEN: "blob storage", "file shares", "queue storage", "table storage", "data lake", "access tiers", "lifecycle management". DO NOT USE FOR: SQL databases, Cosmos DB (use azure-prepare), Event Hubs / Service Bus messaging.'
license: MIT
metadata:
  author: Microsoft
  version: "1.1.0"
---

# Azure Storage Services

## Services

| Service       | Use When                                   | CLI                |
| ------------- | ------------------------------------------ | ------------------ |
| Blob Storage  | Objects, files, backups, static content    | `az storage blob`  |
| File Shares   | SMB file shares, lift-and-shift            | `az storage file`  |
| Queue Storage | Async messaging, task queues               | `az storage queue` |
| Table Storage | NoSQL key-value (consider Cosmos DB)       | `az storage table` |
| Data Lake     | Big data analytics, hierarchical namespace | `az storage fs`    |

## CLI commands

```bash
# List storage accounts
az storage account list --output table

# List containers
az storage container list --account-name ACCOUNT --output table

# List blobs
az storage blob list --account-name ACCOUNT --container-name CONTAINER --output table

# Download blob
az storage blob download --account-name ACCOUNT --container-name CONTAINER --name BLOB --file LOCAL_PATH

# Upload blob
az storage blob upload --account-name ACCOUNT --container-name CONTAINER --name BLOB --file LOCAL_PATH
```

For deeper service docs and patterns, query
`mcp_microsoft-lea_microsoft_docs_search` with the relevant Azure Storage
topic, or follow the links in [Service Details](#service-details).

## Storage Account Tiers

| Tier     | Use Case                | Performance     |
| -------- | ----------------------- | --------------- |
| Standard | General purpose, backup | Milliseconds    |
| Premium  | Databases, high IOPS    | Sub-millisecond |

## Blob Access Tiers

| Tier    | Access Frequency      | Cost                                 |
| ------- | --------------------- | ------------------------------------ |
| Hot     | Frequent              | Higher storage, lower access         |
| Cool    | Infrequent (30+ days) | Lower storage, higher access         |
| Cold    | Rare (90+ days)       | Lower still                          |
| Archive | Rarely (180+ days)    | Lowest storage, rehydration required |

## Redundancy Options

| Type | Durability | Use Case                   |
| ---- | ---------- | -------------------------- |
| LRS  | 11 nines   | Dev/test, recreatable data |
| ZRS  | 12 nines   | Regional high availability |
| GRS  | 16 nines   | Disaster recovery          |
| GZRS | 16 nines   | Best durability            |

## Rules

- **Use Managed Identity over shared keys** — connect via `DefaultAzureCredential` (or equivalent SDK helper) instead of account keys or SAS where possible
- **Disable public blob access** by default; use private endpoints + Entra-only access for prod data
- **Match the access tier to the access pattern** — Hot for active, Cool for 30+ days, Cold for 90+ days, Archive for 180+ days (rehydration required to read)
- **Pick redundancy by RPO/RTO** — LRS for dev, ZRS for regional HA, GRS/GZRS for DR
- **Apply lifecycle management** to auto-tier blobs based on age and last access
- **Premium tier** is for sub-millisecond latency / high-IOPS workloads; default is Standard
- **Security baseline** is non-negotiable — see [iac-security-baseline.md](../../instructions/references/iac-security-baseline.md) (TLS 1.2 minimum, HTTPS-only, public blob disabled, Managed Identity)
- **Out of scope**: SQL / Cosmos DB (use `azure-prepare`), messaging via Event Hubs / Service Bus

## Steps

1. **Identify the storage service** for the workload — see [Services](#services) (Blob / File / Queue / Table / Data Lake)
2. **Choose redundancy** — LRS / ZRS / GRS / GZRS based on RPO/RTO requirements
3. **Choose access tier** — Hot / Cool / Cold / Archive based on expected access frequency
4. **Apply security baseline** — see [iac-security-baseline.md](../../instructions/references/iac-security-baseline.md) (HTTPS-only, TLS 1.2, public blob disabled, Managed Identity)
5. **Run routine operations via `az storage` CLI** — see [CLI commands](#cli-commands)
6. **Wire lifecycle management** for long-lived data to auto-tier and reduce cost

## Service Details

For deep documentation on specific services:

- Blob storage patterns and lifecycle -> [Blob Storage documentation](https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview)
- File shares and Azure File Sync -> [Azure Files documentation](https://learn.microsoft.com/azure/storage/files/storage-files-introduction)
- Queue patterns and poison handling -> [Queue Storage documentation](https://learn.microsoft.com/azure/storage/queues/storage-queues-introduction)

## SDK Quick References

For building applications with Azure Storage SDKs, see the condensed guides:

- **Blob Storage**: [Python](references/sdk/azure-storage-blob-py.md) | [TypeScript](references/sdk/azure-storage-blob-ts.md) | [Java](references/sdk/azure-storage-blob-java.md) | [Rust](references/sdk/azure-storage-blob-rust.md)
- **Queue Storage**: [Python](references/sdk/azure-storage-queue-py.md) | [TypeScript](references/sdk/azure-storage-queue-ts.md)
- **File Shares**: [Python](references/sdk/azure-storage-file-share-py.md) | [TypeScript](references/sdk/azure-storage-file-share-ts.md)
- **Data Lake**: [Python](references/sdk/azure-storage-file-datalake-py.md)
- **Tables**: [Python](references/sdk/azure-data-tables-py.md) | [Java](references/sdk/azure-data-tables-java.md)

For full package listing across all languages, see [SDK Usage Guide](references/sdk-usage.md).

## Azure SDKs

For building applications that interact with Azure Storage programmatically, Azure provides SDK packages in multiple languages (.NET, Java, JavaScript, Python, Go, Rust). See [SDK Usage Guide](references/sdk-usage.md) for package names, installation commands, and quick start examples.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                           | When to Load        |
| ----------------------------------- | ------------------- |
| `references/auth-best-practices.md` | Auth Best Practices |
| `references/sdk-usage.md`           | Sdk Usage           |
