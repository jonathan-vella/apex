---
name: azure-storage
description: '**UTILITY SKILL** — Azure Storage Services including Blob Storage, File Shares, Queue Storage, Table Storage, and Data Lake. Provides object storage, SMB file shares, async messaging, NoSQL key-value, and big data analytics capabilities. Includes access tiers (hot, cool, archive) and lifecycle management. WHEN: "blob storage", "file shares", "queue storage", "table storage", "data lake", "access tiers", "lifecycle management". USE FOR: blob storage, file shares, queue storage, table storage, data lake, upload files, download blobs, storage accounts, access tiers, lifecycle management. DO NOT USE FOR: SQL databases, Cosmos DB (use azure-prepare), messaging with Event Hubs or Service Bus.'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Storage Services

## Services

| Service       | Use When                                   | MCP Tools        | CLI                |
| ------------- | ------------------------------------------ | ---------------- | ------------------ |
| Blob Storage  | Objects, files, backups, static content    | `azure__storage` | `az storage blob`  |
| File Shares   | SMB file shares, lift-and-shift            | -                | `az storage file`  |
| Queue Storage | Async messaging, task queues               | -                | `az storage queue` |
| Table Storage | NoSQL key-value (consider Cosmos DB)       | -                | `az storage table` |
| Data Lake     | Big data analytics, hierarchical namespace | -                | `az storage fs`    |

## MCP Server (Preferred)

When Azure MCP is enabled:

- `azure__storage` with command `storage_account_list` - List storage accounts
- `azure__storage` with command `storage_container_list` - List containers in account
- `azure__storage` with command `storage_blob_list` - List blobs in container
- `azure__storage` with command `storage_blob_get` - Download blob content
- `azure__storage` with command `storage_blob_put` - Upload blob content

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## CLI Fallback

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
- **MCP server first** for storage-account / container / blob operations; CLI fallback only when MCP is unavailable
- **Apply lifecycle management** to auto-tier blobs based on age and last access
- **Premium tier** is for sub-millisecond latency / high-IOPS workloads; default is Standard
- **Out of scope**: SQL / Cosmos DB (use `azure-prepare`), messaging via Event Hubs / Service Bus

## Steps

1. **Identify the storage service** for the workload — see [Services](#services) (Blob / File / Queue / Table / Data Lake)
2. **Choose redundancy** — LRS / ZRS / GRS / GZRS based on RPO/RTO requirements
3. **Choose access tier** — Hot / Cool / Cold / Archive based on expected access frequency
4. **Apply security baseline** — HTTPS-only, TLS 1.2+, public blob disabled, Managed Identity for app access
5. **Use MCP tools** for routine list / get / put operations (`storage_account_list`, `storage_blob_get`, `storage_blob_put`)
6. **Fall back to CLI** when MCP is unavailable — see [CLI Fallback](#cli-fallback)
7. **Wire lifecycle management** for long-lived data to auto-tier and reduce cost

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
