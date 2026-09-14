# Blob Storage — Rust SDK Quick Reference

> Condensed from **azure-storage-blob-rust**. Full patterns (container ops,
> blob properties, RBAC permissions)
> in the **azure-storage-blob-rust** plugin skill if installed.

## Version Gate

The imported snippet did not record crate versions. No compatible version set has
been verified locally: Cargo and the real SDK are unavailable in this workspace.
Do not guess versions or treat the example as a compiled, version-qualified recipe.
Before execution, record exact `azure_storage_blob`, `azure_identity` and
`azure_core` versions from the application's approved Cargo.lock, then verify the
constructor and upload signature against those versions' source/API documentation.
Pin that compatible set in Cargo.toml and compile with `cargo check --locked --offline`
when dependencies are already cached. Missing dependencies remain a verification
gap, not permission to download or substitute a different SDK.

This leaf is the sole Rust example owner. The shape below preserves the imported
RequestContent API; its SDK compatibility remains unverified until that gate passes.

## Quick Start

```rust
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobClient;
let credential = DeveloperToolsCredential::new(None)?;
let blob_client = BlobClient::new("https://<account>.blob.core.windows.net/", "container", "blob", Some(credential), None)?;
```

## Best Practices

- Use Entra ID auth — `DeveloperToolsCredential` for dev, `ManagedIdentityCredential` for production
- Specify content length — required for uploads
- Use `RequestContent::from()` to wrap upload data
- Handle async operations — use `tokio` runtime
- Check RBAC permissions — ensure "Storage Blob Data Contributor" role

## Non-Obvious Patterns

Within an async function returning a compatible error type, upload authorized
bytes to a pre-existing container. `false` keeps overwrite disabled. Do not replace
the content/overwrite/length/options signature with an unverified two-argument call.

```rust
use azure_core::http::RequestContent;
let data = b"Hello, Azure Storage!";
let content_length = u64::try_from(data.len())?;
blob_client
	.upload(RequestContent::from(data.to_vec()), false, content_length, None)
	.await?;
```
