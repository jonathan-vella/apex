# terraform-e2e — Archived Terraform Configuration

The Terraform source files for this project have been archived and split into 5 MB chunks
for storage and transfer compatibility.

> **Note:** The `.terraform/` provider cache directory is gitignored and is **not** included
> in the archive. Run `terraform init` after extraction to restore providers.

## Archive contents

| File                        | Size                                                 |
| --------------------------- | ---------------------------------------------------- |
| `terraform-e2e.zip`         | ~853 KB (original zip, source files only)            |
| `terraform-e2e.zip.part_aa` | 853 KB (single part — archive fits within one chunk) |

## Reassembly instructions

### Linux / macOS

```bash
# Reassemble from parts
cat terraform-e2e.zip.part_* > terraform-e2e-restored.zip

# Verify integrity against the original
md5sum terraform-e2e.zip terraform-e2e-restored.zip

# Extract
unzip terraform-e2e-restored.zip

# Restore Terraform providers
cd infra/terraform/terraform-e2e
terraform init
```

### Windows (PowerShell)

```powershell
# Reassemble from parts
$parts = Get-ChildItem -Filter "terraform-e2e.zip.part_*" | Sort-Object Name
$out = [System.IO.File]::OpenWrite("terraform-e2e-restored.zip")
foreach ($part in $parts) {
    $bytes = [System.IO.File]::ReadAllBytes($part.FullName)
    $out.Write($bytes, 0, $bytes.Length)
}
$out.Close()

# Extract
Expand-Archive terraform-e2e-restored.zip -DestinationPath .

# Restore Terraform providers
Set-Location infra/terraform/terraform-e2e
terraform init
```

## Notes

- The parts must be concatenated in alphabetical order (`_aa`, `_ab`, … if more parts exist).
- The original `terraform-e2e.zip` is retained alongside the parts as a reference; you can
  delete it after verifying the restored archive matches.
- The `.terraform/` provider cache is excluded — always run `terraform init` after extraction.
