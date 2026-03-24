<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Storage Services (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Services

| Service       | Use When                                | MCP Tools        | CLI                |
| ------------- | --------------------------------------- | ---------------- | ------------------ |
| Blob Storage  | Objects, files, backups, static content | `azure__storage` | `az storage blob`  |
| File Shares   | SMB file shares, lift-and-shift         | -                | `az storage file`  |
| Queue Storage | Async messaging, task queues            | -                | `az storage queue` |
| Table Storage | NoSQL key-value (consider Cosmos DB)    | -                | `az storage table` |

> _See SKILL.md for full content._

## MCP Server (Preferred)

When Azure MCP is enabled:

- `azure__storage` with command `storage_account_list` - List storage accounts
- `azure__storage` with command `storage_container_list` - List containers in account
- `azure__storage` with command `storage_blob_list` - List blobs in container
- `azure__storage` with command `storage_blob_get` - Download blob content

> _See SKILL.md for full content._

## CLI Fallback

```bash
# List storage accounts
az storage account list --output table

# List containers
az storage container list --account-name ACCOUNT --output table

> _See SKILL.md for full content._

## Storage Account Tiers

| Tier | Use Case | Performance |
|------|----------|-------------|
| Standard | General purpose, backup | Milliseconds |
| Premium | Databases, high IOPS | Sub-millisecond |

## Blob Access Tiers

| Tier | Access Frequency | Cost |
|------|-----------------|------|
| Hot | Frequent | Higher storage, lower access |
| Cool | Infrequent (30+ days) | Lower storage, higher access |
| Cold | Rare (90+ days) | Lower still |
| Archive | Rarely (180+ days) | Lowest storage, rehydration required |

> _See SKILL.md for full content._

## Redundancy Options

| Type | Durability | Use Case |
|------|------------|----------|
| LRS | 11 nines | Dev/test |
| ZRS | 12 nines | Regional HA |
| GRS/GZRS | 16 nines | Disaster recovery |
```
